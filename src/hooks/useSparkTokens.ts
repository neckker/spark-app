import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'

import { terminalUrl } from '@/lib/refferal'
import { WS_URL, BACKEND_URL } from '@/config/env'
import { useSettings } from '@/context/SettingsContext'

type WsStatus = 'connecting' | 'open' | 'closed' | 'error'
type PriceStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TokenEvent = {
    address: string
    name: string
    ticker: string
    devhold: number
    protocol: 'pump' | 'bonk' | string
    market_cap: number
    metadata_url: string | null
    is_mayhem_mode: boolean
}

export type DevTokenStats = {
    total: number
    migrated: number
    rate: number
}

export type DevInfo = {
    address: string
    tokens: DevTokenStats
}

export type LastToken = {
    pair: string
    address: string
    name: string
    image: string
    ticker: string
    supply: number
    created_at: number
    price: number
    market_cap: number
    is_migrated: boolean
    total_fees: number | null
    is_dex_paid: boolean | null
    dex_paid_at: number | null
    peak_mcap: number | null
    ath_price: number | null
    ath_time: number | null
}

export type WsTokenMessage = {
    newpair: TokenEvent
    dev: DevInfo
    last_tokens: LastToken[]
}

export type Metadata = {
    name?: string | null
    ticker?: string | null
    image_url?: string | null
    telegram?: string | null
    website?: string | null
    twitter?: string | null
    has_socials?: boolean
}

export type TokenCardModel = {
    id: string
    token: TokenEvent
    dev: DevInfo
    lastTokens: LastToken[]
    metadata: Metadata | null
    metaStatus: 'idle' | 'loading' | 'ready' | 'error'
}

type WsMessage = Record<string, unknown>

const MAX_TOKENS = 10
const META_TIMEOUT_MS = 1500
const META_RETRY_ATTEMPTS = 5
const META_RETRY_DELAY_MS = 1500

const PRICE_PATH = '/hub/price'
const PRICE_POLL_MS = 30_000

const http = axios.create({
    baseURL: BACKEND_URL,
    timeout: META_TIMEOUT_MS,
    headers: { Accept: 'application/json' }
})

function isWsTokenMessage(x: unknown): x is WsTokenMessage {
    if (!x || typeof x !== 'object') return false
    const v = x as Record<string, unknown>

    const np = v.newpair
    if (!np || typeof np !== 'object') return false
    const p = np as Record<string, unknown>
    if (
        typeof p.address !== 'string' ||
        typeof p.name !== 'string' ||
        typeof p.ticker !== 'string' ||
        typeof p.devhold !== 'number' ||
        typeof p.protocol !== 'string' ||
        (typeof p.metadata_url !== 'string' && p.metadata_url !== null)
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

function normalizeLastTokens(raw: unknown[]): LastToken[] {
    return raw
        .filter(item => item && typeof item === 'object')
        .map(item => {
            const r = item as Record<string, unknown>
            return {
                pair:        typeof r.pair === 'string'    ? r.pair    : '',
                address:     typeof r.address === 'string' ? r.address : '',
                name:        typeof r.name === 'string'    ? r.name    : '',
                image:       typeof r.image === 'string'   ? r.image   : '',
                ticker:      typeof r.ticker === 'string'  ? r.ticker  : '',
                supply:      typeof r.supply === 'number'  ? r.supply  : 0,
                created_at:  typeof r.created_at === 'number'  ? r.created_at  : 0,
                price:       typeof r.price === 'number'   ? r.price   : 0,
                market_cap:  typeof r.market_cap === 'number'  ? r.market_cap  : 0,
                is_migrated: typeof r.is_migrated === 'boolean' ? r.is_migrated : false,
                total_fees:  typeof r.total_fees === 'number'  ? r.total_fees  : null,
                is_dex_paid: typeof r.is_dex_paid === 'boolean' ? r.is_dex_paid : null,
                dex_paid_at: typeof r.dex_paid_at === 'number'  ? r.dex_paid_at : null,
                peak_mcap:   typeof r.peak_mcap === 'number'    ? r.peak_mcap   : null,
                ath_price:   typeof r.ath_price === 'number'    ? r.ath_price   : null,
                ath_time:    typeof r.ath_time === 'number'     ? r.ath_time    : null,
            }
        })
        .slice(0, 3)
}

function normalizeMetadata(raw: any): Metadata | null {
    if (!raw || typeof raw !== 'object') return null
    const m: Metadata = {
        name:      typeof raw.name === 'string' ? raw.name : null,
        ticker:
            typeof raw.symbol === 'string' ? raw.symbol :
            typeof raw.ticker === 'string' ? raw.ticker : null,
        image_url:
            typeof raw.image === 'string'     ? raw.image :
            typeof raw.image_url === 'string' ? raw.image_url : null,
        telegram:  typeof raw.telegram === 'string' ? raw.telegram : null,
        website:
            typeof raw.website === 'string'      ? raw.website :
            typeof raw.external_url === 'string' ? raw.external_url : null,
        twitter:   typeof raw.twitter === 'string' ? raw.twitter : null,
    }
    m.has_socials = Boolean(m.twitter || m.telegram || m.website)
    return m
}

// ─── fees filter helper ────────────────────────────────────────────────────────

/**
 * Returns true if the token should PASS the fees filter (i.e. should be shown).
 * When the filter is disabled → always pass.
 * Tokens with no fee data (all null) → pass through (we can't filter what we don't have).
 */
function passesFeeFilter(
    lastTokens: LastToken[],
    enabled: boolean,
    mode: 'total' | 'average',
    threshold: number
): boolean {
    if (!enabled) return true

    // Collect only tokens that have fee data
    const withFees = lastTokens.filter(t => t.total_fees !== null) as (LastToken & { total_fees: number })[]

    // No fee data available → let it through (can't filter without data)
    if (withFees.length === 0) return true

    if (mode === 'total') {
        const sum = withFees.reduce((acc, t) => acc + t.total_fees, 0)
        return sum >= threshold
    } else {
        const avg = withFees.reduce((acc, t) => acc + t.total_fees, 0) / withFees.length
        return avg >= threshold
    }
}

export function useSparkTokens() {
    const { settings, isBlacklisted } = useSettings()

    const openInBrowserRef = useRef(settings.openInBrowser)
    const terminalRef      = useRef(settings.terminal)
    const filtersRef = useRef({
        devMin:           settings.devMin,
        devMax:           settings.devMax,
        migrationPct:     settings.migrationPct,
        hideMayhem:       settings.hideMayhem,
        feesFilterEnabled: settings.feesFilterEnabled,
        feesFilterMode:   settings.feesFilterMode,
        feesFilterValue:  settings.feesFilterValue,
    })

    useEffect(() => { openInBrowserRef.current = settings.openInBrowser }, [settings.openInBrowser])
    useEffect(() => { terminalRef.current = settings.terminal },           [settings.terminal])
    useEffect(() => {
        filtersRef.current = {
            devMin:            settings.devMin,
            devMax:            settings.devMax,
            migrationPct:      settings.migrationPct,
            hideMayhem:        settings.hideMayhem,
            feesFilterEnabled: settings.feesFilterEnabled,
            feesFilterMode:    settings.feesFilterMode,
            feesFilterValue:   settings.feesFilterValue,
        }
    }, [
        settings.devMin, settings.devMax, settings.migrationPct,
        settings.hideMayhem,
        settings.feesFilterEnabled, settings.feesFilterMode, settings.feesFilterValue,
    ])

    const isBlacklistedRef = useRef(isBlacklisted)
    useEffect(() => { isBlacklistedRef.current = isBlacklisted }, [isBlacklisted])

    const wsRef              = useRef<WebSocket | null>(null)
    const reconnectRef       = useRef<number | null>(null)
    const lastPingRecvRef    = useRef<number | null>(null)
    const metaInflightRef    = useRef<Map<string, AbortController>>(new Map())
    const metaRetryTimersRef = useRef<Map<string, number>>(new Map())
    const totalProcessedRef  = useRef<number>(0)
    const priceTimerRef      = useRef<number | null>(null)
    const priceAbortRef      = useRef<AbortController | null>(null)

    const [status, setStatus]                 = useState<WsStatus>('connecting')
    const [pingMs, setPingMs]                 = useState<number | null>(null)
    const [tokens, setTokens]                 = useState<TokenCardModel[]>([])
    const [totalProcessed, setTotalProcessed] = useState<number>(0)
    const [solPriceUsd, setSolPriceUsd]       = useState<number | null>(null)
    const [solPriceStatus, setSolPriceStatus] = useState<PriceStatus>('idle')

    const clearReconnect = () => {
        if (reconnectRef.current !== null) {
            window.clearTimeout(reconnectRef.current)
            reconnectRef.current = null
        }
    }

    const cancelMeta = (tokenId: string) => {
        metaInflightRef.current.get(tokenId)?.abort()
        metaInflightRef.current.delete(tokenId)
        const timer = metaRetryTimersRef.current.get(tokenId)
        if (timer !== undefined) {
            window.clearTimeout(timer)
            metaRetryTimersRef.current.delete(tokenId)
        }
    }

    const stopAllMeta = () => {
        for (const id of [...metaInflightRef.current.keys()]) cancelMeta(id)
    }

    const stopPricePolling = () => {
        if (priceTimerRef.current !== null) {
            window.clearInterval(priceTimerRef.current)
            priceTimerRef.current = null
        }
        priceAbortRef.current?.abort()
        priceAbortRef.current = null
    }

    const fetchSolPrice = async (silent = false) => {
        priceAbortRef.current?.abort()
        const ctrl = new AbortController()
        priceAbortRef.current = ctrl
        if (!silent) setSolPriceStatus('loading')
        try {
            const res  = await http.get(PRICE_PATH, { signal: ctrl.signal })
            const data = res.data as { ok?: boolean; price?: number }
            if (!data || data.ok !== true || typeof data.price !== 'number') {
                setSolPriceStatus('error'); return
            }
            setSolPriceUsd(data.price)
            setSolPriceStatus('ready')
        } catch {
            setSolPriceStatus('error')
        } finally {
            if (priceAbortRef.current === ctrl) priceAbortRef.current = null
        }
    }

    const startPricePolling = () => {
        stopPricePolling()
        void fetchSolPrice(false)
        priceTimerRef.current = window.setInterval(() => void fetchSolPrice(true), PRICE_POLL_MS)
    }

    const attemptMeta = (tokenId: string, metadataUrl: string, attemptsLeft: number) => {
        const prevTimer = metaRetryTimersRef.current.get(tokenId)
        if (prevTimer !== undefined) {
            window.clearTimeout(prevTimer)
            metaRetryTimersRef.current.delete(tokenId)
        }
        metaInflightRef.current.get(tokenId)?.abort()
        const ctrl = new AbortController()
        metaInflightRef.current.set(tokenId, ctrl)

        http
            .get('/hub/meta', { signal: ctrl.signal, params: { url: metadataUrl } })
            .then(res => {
                if (ctrl.signal.aborted) return
                const data = res.data
                if (data && typeof data === 'object' && data.ok === false) {
                    if (attemptsLeft > 0) {
                        const timer = window.setTimeout(() => {
                            metaRetryTimersRef.current.delete(tokenId)
                            attemptMeta(tokenId, metadataUrl, attemptsLeft - 1)
                        }, META_RETRY_DELAY_MS)
                        metaRetryTimersRef.current.set(tokenId, timer)
                    } else {
                        setTokens(prev => prev.map(x => x.id === tokenId ? { ...x, metadata: null, metaStatus: 'error' } : x))
                        metaInflightRef.current.delete(tokenId)
                    }
                    return
                }
                const meta = normalizeMetadata(data)
                setTokens(prev => prev.map(x => x.id === tokenId
                    ? { ...x, metadata: meta, metaStatus: meta ? 'ready' : 'error' }
                    : x
                ))
                metaInflightRef.current.delete(tokenId)
            })
            .catch((err: any) => {
                if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || ctrl.signal.aborted) return
                const isRetryable =
                    err?.code === 'ECONNABORTED' ||
                    err?.code === 'ERR_NETWORK'  ||
                    err?.message === 'Network Error'
                if (isRetryable && attemptsLeft > 0) {
                    const timer = window.setTimeout(() => {
                        metaRetryTimersRef.current.delete(tokenId)
                        attemptMeta(tokenId, metadataUrl, attemptsLeft - 1)
                    }, META_RETRY_DELAY_MS)
                    metaRetryTimersRef.current.set(tokenId, timer)
                    return
                }
                setTokens(prev => prev.map(x => x.id === tokenId ? { ...x, metadata: null, metaStatus: 'error' } : x))
                metaInflightRef.current.delete(tokenId)
            })
    }

    const fetchMetadata = (tokenId: string, metadataUrl: string) => {
        attemptMeta(tokenId, metadataUrl, META_RETRY_ATTEMPTS)
    }

    const connect = (attempt = 0) => {
        clearReconnect()
        stopAllMeta()
        setStatus('connecting')

        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen  = () => setStatus('open')
        ws.onerror = () => setStatus('error')
        ws.onclose = () => {
            setStatus('closed')
            const base   = Math.min(10_000, 500 * 2 ** attempt)
            const jitter = Math.floor(Math.random() * 250)
            reconnectRef.current = window.setTimeout(() => connect(attempt + 1), base + jitter)
        }

        ws.onmessage = evt => {
            if (typeof evt.data !== 'string') return
            let parsed: unknown
            try { parsed = JSON.parse(evt.data) } catch { return }
            if (typeof parsed !== 'object' || parsed === null) return
            const msg = parsed as WsMessage

            if (msg.type === 'ping') {
                lastPingRecvRef.current = performance.now()
                ws.send('pong')
                return
            }
            if (msg.type === 'pong_ack') {
                const t0 = lastPingRecvRef.current
                if (t0 !== null) setPingMs(Math.round(performance.now() - t0))
                return
            }

            if (!isWsTokenMessage(parsed)) return

            const { newpair, dev, last_tokens } = parsed

            const {
                devMin, devMax, migrationPct,
                hideMayhem,
                feesFilterEnabled, feesFilterMode, feesFilterValue,
            } = filtersRef.current

            // ── dev holdings filter ──
            if (newpair.devhold < devMin || newpair.devhold > devMax) return

            // ── migration rate filter ──
            if (dev.tokens.rate < migrationPct) return

            // ── blacklist filter ──
            if (isBlacklistedRef.current(dev.address)) return

            // ── mayhem filter ──
            if (hideMayhem && newpair.is_mayhem_mode === true) return

            // ── normalize last tokens first so we can run the fees check ──
            const lastTokens = normalizeLastTokens(last_tokens)

            // ── fees filter ──
            if (!passesFeeFilter(lastTokens, feesFilterEnabled, feesFilterMode, feesFilterValue)) return

            totalProcessedRef.current += 1
            setTotalProcessed(totalProcessedRef.current)

            const id = newpair.address
            if (openInBrowserRef.current) void openUrl(terminalUrl(id, terminalRef.current))

            setTokens(prevTokens => {
                const rest = prevTokens.filter(x => x.id !== id)
                const item: TokenCardModel = {
                    id,
                    token: newpair,
                    dev,
                    lastTokens,
                    metadata: null,
                    metaStatus: newpair.metadata_url && newpair.metadata_url.length ? 'loading' : 'error'
                }
                return [item, ...rest].slice(0, MAX_TOKENS)
            })

            if (newpair.metadata_url) {
                cancelMeta(id)
                fetchMetadata(id, newpair.metadata_url)
            }
        }
    }

    useEffect(() => {
        connect(0)
        startPricePolling()
        return () => {
            clearReconnect()
            stopAllMeta()
            stopPricePolling()
            wsRef.current?.close()
            wsRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        status,
        pingMs,
        tokens,
        totalProcessed,
        clearTokens: () => setTokens([]),
        solPriceUsd,
        solPriceStatus,
    }
}
