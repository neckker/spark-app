import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import { SEQUOIA_WS_URL } from '@/config/env'
import { getToken } from '@/lib/http'
import { useAuth } from '@/context/AuthContext'
import { useTokenAnalyzer as useAnalyzerCtx } from '@/context/TokenAnalyzerContext'
import { useNotificationSound } from '@/hooks/useNotificationSound'
import {
    clearHistory,
    loadFeedEnabled,
    loadHistory,
    saveFeedEnabled,
    saveHistory
} from '@/lib/liveFeedHistory'
import { terminalUrl } from '@/lib/liveFeedTerminals'
import type { Filters, FeesMode, FeesSource } from '@/types/liveFeed'

export type WsStatus =
    | 'idle'
    | 'connecting'
    | 'open'
    | 'closed'
    | 'error'
    | 'offline'

export interface Metadata {
    image: string | null
    xlink: string | null
    website: string | null
    telegram: string | null
    has_socials: boolean
}

export interface TokenEvent {
    pair: string
    name: string
    ticker: string
    address: string
    devhold: number
    protocol: string
    market_cap: number
    metadata: Metadata | null
    is_mayhem_mode: boolean
}

interface WireTokenEvent {
    pair: string
    name: string
    ticker: string
    address: string
    devhold: number
    protocol: string
    market_cap: number
    is_mayhem_mode: boolean
    metadata: unknown
}

export interface DevTokenStats {
    total: number
    migrated: number
    rate: number
}

export interface Funding {
    amount: number
    funded_at: number
    wallet: string | null
    signature: string | null
    funding_wallet: string | null
}

export interface DevInfo {
    address: string
    tokens: DevTokenStats
    funding: Funding | null
}

export interface LastToken {
    ticker: string
    image: string
    address: string
    pair: string | null
    is_migrated: boolean
    created_at: number
    dex_paid: boolean
    fees: { axiom: number; gmgn: number }
    volume: number
    market_cap: number
    ath_mcap: number
}

interface WsTokenMessage {
    newpair: WireTokenEvent
    dev: DevInfo
    last_tokens: unknown[]
    sol_price: number | null
}

export interface TokenCardModel {
    id: string
    token: TokenEvent
    dev: DevInfo
    lastTokens: LastToken[]
}

interface WsControlMessage {
    type?: unknown
}

const MAX_TOKENS = 10

const WS_RECONNECT_BASE_MS = 500
const WS_RECONNECT_MAX_MS = 10_000
const WS_RECONNECT_JITTER_MS = 250

const MAX_RECONNECT_RETRIES = 7

const decoder = new TextDecoder()

function decodeBinary(data: unknown): unknown {
    if (data instanceof ArrayBuffer) {
        return JSON.parse(decoder.decode(data))
    }
    if (typeof data === 'string') {
        return JSON.parse(data)
    }
    return null
}

function isWsTokenMessage(x: unknown): x is WsTokenMessage {
    if (!x || typeof x !== 'object') return false
    const v = x as Record<string, unknown>

    const np = v.newpair
    if (!np || typeof np !== 'object') return false
    const p = np as Record<string, unknown>
    if (
        typeof p.pair !== 'string' ||
        typeof p.name !== 'string' ||
        typeof p.ticker !== 'string' ||
        typeof p.address !== 'string' ||
        typeof p.devhold !== 'number' ||
        typeof p.protocol !== 'string'
    ) return false

    const dev = v.dev
    if (!dev || typeof dev !== 'object') return false
    const d = dev as Record<string, unknown>
    if (typeof d.address !== 'string') return false

    const tk = d.tokens
    if (!tk || typeof tk !== 'object') return false
    const t = tk as Record<string, unknown>
    if (
        typeof t.total !== 'number' ||
        typeof t.migrated !== 'number' ||
        typeof t.rate !== 'number'
    ) return false

    if (!Array.isArray(v.last_tokens)) return false

    return true
}

function normalizeMetadata(raw: unknown): Metadata | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (Object.keys(r).length === 0) return null

    const xlink =
        typeof r.xlink === 'string' && r.xlink !== 'None' ? r.xlink : null
    const website =
        typeof r.website === 'string' && r.website !== 'None' ? r.website : null
    const telegram =
        typeof r.telegram === 'string' && r.telegram !== 'None' ? r.telegram : null

    return {
        image: typeof r.image === 'string' ? r.image : null,
        xlink,
        website,
        telegram,
        has_socials: Boolean(xlink || telegram || website)
    }
}

function normalizeLastTokens(raw: unknown[]): LastToken[] {
    return raw
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            const r = item as Record<string, unknown>
            const fees =
                r.fees && typeof r.fees === 'object'
                    ? (r.fees as Record<string, unknown>)
                    : {}
            return {
                ticker: typeof r.ticker === 'string' ? r.ticker : '',
                image: typeof r.image === 'string' ? r.image : '',
                address: typeof r.address === 'string' ? r.address : '',
                pair: typeof r.pair === 'string' ? r.pair : null,
                is_migrated: typeof r.is_migrated === 'boolean' ? r.is_migrated : false,
                created_at: typeof r.created_at === 'number' ? r.created_at : 0,
                dex_paid: typeof r.dex_paid === 'boolean' ? r.dex_paid : false,
                fees: {
                    axiom: typeof fees.axiom === 'number' ? fees.axiom : 0,
                    gmgn: typeof fees.gmgn === 'number' ? fees.gmgn : 0
                },
                volume: typeof r.volume === 'number' ? r.volume : 0,
                market_cap: typeof r.market_cap === 'number' ? r.market_cap : 0,
                ath_mcap: typeof r.ath_mcap === 'number' ? r.ath_mcap : 0
            }
        })
        .slice(0, 3)
}

function passesFeeFilter(
    lastTokens: LastToken[],
    enabled: boolean,
    mode: FeesMode,
    threshold: number,
    source: FeesSource
): boolean {
    if (!enabled) return true
    if (lastTokens.length === 0) return false

    const getFee = (t: LastToken) => source === 'axiom' ? t.fees.axiom : t.fees.gmgn

    if (mode === 'each') return lastTokens.every((t) => getFee(t) >= threshold)

    const sum = lastTokens.reduce((acc, t) => acc + getFee(t), 0)
    if (mode === 'total') return sum >= threshold
    return sum / lastTokens.length >= threshold
}

export function useTokenAnalyzer() {
    const {
        config,
        activeFilters,
        isWhitelistedDev,
        isBlacklistedDev
    } = useAnalyzerCtx()
    const { revalidate } = useAuth()

    const playSound = useNotificationSound(
        config.app.soundEnabled,
        config.app.soundVolume
    )

    const latestRef = useRef({
        playSound,
        app: config.app,
        filters: activeFilters,
        isWhitelistedDev,
        isBlacklistedDev
    })
    latestRef.current = {
        playSound,
        app: config.app,
        filters: activeFilters,
        isWhitelistedDev,
        isBlacklistedDev
    }

    useEffect(() => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(buildConfigMessage(activeFilters)))
        }
    }, [
        activeFilters.devHold.enabled,
        activeFilters.devHold.min,
        activeFilters.devHold.max,
        activeFilters.migration.enabled,
        activeFilters.migration.pct
    ])

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectRef = useRef<number | null>(null)
    const reconnectAttemptsRef = useRef<number>(0)
    const lastPingRecvRef = useRef<number | null>(null)
    const totalProcessedRef = useRef<number>(0)

    const initialHistory = useRef(loadHistory()).current

    const [status, setStatus] = useState<WsStatus>('idle')
    const [pingMs, setPingMs] = useState<number | null>(null)
    const [tokens, setTokens] = useState<TokenCardModel[]>(initialHistory.tokens)
    const [totalProcessed, setTotalProcessed] = useState<number>(0)
    const [solPriceUsd, setSolPriceUsd] = useState<number | null>(initialHistory.solPriceUsd)
    const [enabled, setEnabled] = useState<boolean>(() => loadFeedEnabled())
    const [idle, setIdle] = useState<boolean>(false)

    const enabledRef = useRef(enabled)
    enabledRef.current = enabled

    useEffect(() => {
        saveHistory(tokens, solPriceUsd)
    }, [tokens, solPriceUsd])

    const clearReconnect = () => {
        if (reconnectRef.current !== null) {
            window.clearTimeout(reconnectRef.current)
            reconnectRef.current = null
        }
    }

    const connect = () => {
        clearReconnect()

        if (wsRef.current) {
            wsRef.current.onclose = null
            wsRef.current.close()
        }

        setStatus('connecting')

        const token = getToken()
        const url = token
            ? `${SEQUOIA_WS_URL}?token=${encodeURIComponent(token)}`
            : SEQUOIA_WS_URL

        const ws = new WebSocket(url)
        ws.binaryType = 'arraybuffer'
        wsRef.current = ws

        ws.onopen = () => {
            setStatus('open')
            reconnectAttemptsRef.current = 0
            ws.send(JSON.stringify(buildConfigMessage(latestRef.current.filters)))
        }
        ws.onerror = () => setStatus('error')

        ws.onclose = (ev) => {
            void revalidate()

            if (ev.code === 1008 && ev.reason === 'already_connected') {
                setStatus('offline')
                return
            }

            const next = reconnectAttemptsRef.current + 1
            if (next > MAX_RECONNECT_RETRIES) {
                setStatus('offline')
                return
            }

            reconnectAttemptsRef.current = next
            setStatus('closed')
            const delay =
                Math.min(
                    WS_RECONNECT_MAX_MS,
                    WS_RECONNECT_BASE_MS * 2 ** (next - 1)
                ) +
                Math.floor(Math.random() * WS_RECONNECT_JITTER_MS)
            reconnectRef.current = window.setTimeout(connect, delay)
        }

        ws.onmessage = (evt) => {
            let parsed: unknown
            try { parsed = decodeBinary(evt.data) } catch { return }
            if (!parsed || typeof parsed !== 'object') return

            const ctrl = parsed as WsControlMessage

            if (ctrl.type === 'ping') {
                lastPingRecvRef.current = performance.now()
                ws.send('pong')
                return
            }

            if (ctrl.type === 'pong_ack') {
                const t0 = lastPingRecvRef.current
                if (t0 !== null) setPingMs(Math.round(performance.now() - t0))
                return
            }

            if (!isWsTokenMessage(parsed)) return

            const {
                filters: f,
                playSound,
                app,
                isWhitelistedDev,
                isBlacklistedDev
            } = latestRef.current

            const { newpair, dev, last_tokens, sol_price } = parsed

            if (typeof sol_price === 'number' && sol_price > 0) {
                setSolPriceUsd(sol_price)
            }

            const metadata = normalizeMetadata(newpair.metadata)
            const lastTokens = normalizeLastTokens(last_tokens)

            const whitelisted = isWhitelistedDev(dev.address)

            if (!whitelisted) {
                if (isBlacklistedDev(dev.address)) return

                if (newpair.protocol === 'pump' && newpair.is_mayhem_mode && !f.showMayhem) return
                if (newpair.protocol === 'pump' && !newpair.is_mayhem_mode && !f.showPump) return
                if (newpair.protocol === 'bonk' && !f.showBonk) return

                if (f.requireSocials && !metadata?.has_socials) return

                if (f.devHold.enabled) {
                    if (newpair.devhold < f.devHold.min) return
                    if (newpair.devhold > f.devHold.max) return
                }

                if (f.migration.enabled) {
                    if (dev.tokens.rate < f.migration.pct) return
                    if (
                        f.migration.requireLastMigrated &&
                        lastTokens.length > 0 &&
                        !lastTokens[0].is_migrated
                    ) return
                }

                if (!passesFeeFilter(
                    lastTokens,
                    f.fees.enabled,
                    f.fees.mode,
                    f.fees.minSol,
                    f.fees.source
                )) return

                if (f.funding.enabled && dev.funding) {
                    const fund = f.funding
                    const amount = dev.funding.amount
                    if (fund.amountMin != null && amount < fund.amountMin) return
                    if (fund.amountMax != null && amount > fund.amountMax) return
                    if (dev.funding.funded_at > 0) {
                        const ageMs = Date.now() - dev.funding.funded_at
                        if (fund.ageMinHours != null
                            && ageMs < fund.ageMinHours * 3_600_000) return
                        if (fund.ageMaxHours != null
                            && ageMs > fund.ageMaxHours * 3_600_000) return
                    }
                }
            }

            playSound()
            totalProcessedRef.current += 1
            setTotalProcessed(totalProcessedRef.current)

            const id = newpair.address

            if (app.openInBrowser) {
                void invoke('set_open_url', {
                    url: terminalUrl(id, newpair.pair, app.terminal)
                })
            }

            const tokenEvent: TokenEvent = {
                pair: newpair.pair,
                name: newpair.name,
                ticker: newpair.ticker,
                address: newpair.address,
                devhold: newpair.devhold,
                protocol: newpair.protocol,
                market_cap: newpair.market_cap,
                is_mayhem_mode: newpair.is_mayhem_mode,
                metadata
            }

            setTokens((prev) => {
                const rest = prev.filter((x) => x.id !== id)
                const item: TokenCardModel = {
                    id,
                    token: tokenEvent,
                    dev,
                    lastTokens
                }
                return [item, ...rest].slice(0, MAX_TOKENS)
            })
        }
    }

    const disconnect = () => {
        clearReconnect()
        reconnectAttemptsRef.current = 0
        if (wsRef.current) {
            wsRef.current.onclose = null
            wsRef.current.onerror = null
            wsRef.current.close()
            wsRef.current = null
        }
        setStatus('idle')
        setPingMs(null)
    }

    const toggleFeed = () => {
        const next = !enabled
        setEnabled(next)
        saveFeedEnabled(next)
        setIdle(false)
        if (next) connect()
        else disconnect()
    }

    useEffect(() => {
        if (enabled) connect()
        return () => {
            clearReconnect()
            if (wsRef.current) {
                wsRef.current.onclose = null
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        let unlisten: (() => void) | undefined
        void listen<boolean>('idle-changed', (event) => {
            const isIdle = event.payload === true
            setIdle(isIdle)
            if (isIdle) disconnect()
            else if (enabledRef.current) connect()
        }).then((fn) => {
            unlisten = fn
        })
        return () => {
            unlisten?.()
        }
    }, [])

    useEffect(() => {
        void invoke('set_feed_active', { active: enabled })
    }, [enabled])

    return {
        status,
        idle,
        pingMs,
        tokens,
        totalProcessed,
        solPriceUsd,
        enabled,
        toggleFeed,
        clearTokens: () => {
            clearHistory()
            setTokens([])
        }
    }
}

function buildConfigMessage(f: Filters) {
    return {
        type: 'config',
        migration_pct: f.migration.enabled ? f.migration.pct : 5,
        min_dev_hold: f.devHold.enabled ? f.devHold.min : 0.1,
        max_dev_hold: f.devHold.enabled ? f.devHold.max : 100
    }
}
