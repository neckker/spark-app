import { useEffect, useRef, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { invoke } from '@tauri-apps/api/core'

import { terminalUrl } from '@/lib/refferal'
import { WS_URL } from '@/config/env'
import { useSettings } from '@/context/SettingsContext'
import { useNotificationSound } from '@/hooks/useNotificationSound'

// --- types ---

type WsStatus = 'connecting' | 'open' | 'closed' | 'error'

export type XCommunityCreator = {
    id: string
    name: string | null
    screen_name: string | null
    avatar: string | null
    following_count: number
    followers_count: number
    is_blue_verified: boolean
    joined_at: number
}

export type XCommunity = {
    id: string
    name: string
    access: string | null
    banner: string | null
    member_count: number
    description: string | null
    created_at: number
    creator: XCommunityCreator | null
}

export type Metadata = {
    image: string | null
    xlink: string | null
    website: string | null
    telegram: string | null
    xcommunity: XCommunity | null
    has_socials: boolean
    xtype: [string, ...string[]] | null
}

export type TokenEvent = {
    pair: string
    name: string
    ticker: string
    address: string
    devhold: number
    protocol: 'pump' | 'bonk' | string
    market_cap: number
    metadata: Metadata | null
    is_mayhem_mode: boolean
}

export type DevTokenStats = {
    total: number
    migrated: number
    rate: number
}

export type Funding = {
    amount: number
    funded_at: number
    wallet: string | null
    signature: string | null
    funding_wallet: string | null
}

export type DevInfo = {
    address: string
    tokens: DevTokenStats
    funding: Funding | null
}

export type LastToken = {
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

export type WsTokenMessage = {
    newpair: TokenEvent
    dev: DevInfo
    last_tokens: LastToken[]
    sol_price: number | null
}

export type TokenCardModel = {
    id: string
    token: TokenEvent
    dev: DevInfo
    lastTokens: LastToken[]
}

type WsMessage = Record<string, unknown>

// --- constants ---

const MAX_TOKENS = 10

const WS_RECONNECT_BASE_MS = 500
const WS_RECONNECT_MAX_MS = 10_000
const WS_RECONNECT_JITTER_MS = 250

// --- binary decode ---

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

// --- ws message validation ---

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

// --- normalizers ---

function normalizeMetadata(raw: unknown): Metadata | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>

    // empty metadata object from server
    if (Object.keys(r).length === 0) return null

    const xlink = typeof r.xlink === 'string' && r.xlink !== 'None' ? r.xlink : null
    const website = typeof r.website === 'string' && r.website !== 'None' ? r.website : null
    const telegram = typeof r.telegram === 'string' && r.telegram !== 'None' ? r.telegram : null

    let xcommunity: XCommunity | null = null
    if (r.xcommunity && typeof r.xcommunity === 'object' && r.xcommunity !== null && typeof (r.xcommunity as Record<string, unknown>).id === 'string') {
        const c = r.xcommunity as Record<string, unknown>
        let creator: XCommunityCreator | null = null
        if (c.creator && typeof c.creator === 'object') {
            const cr = c.creator as Record<string, unknown>
            creator = {
                id: String(cr.id ?? ''),
                name: typeof cr.name === 'string' ? cr.name : null,
                screen_name: typeof cr.screen_name === 'string' ? cr.screen_name : null,
                avatar: typeof cr.avatar === 'string' ? cr.avatar : null,
                following_count: typeof cr.following_count === 'number' ? cr.following_count : 0,
                followers_count: typeof cr.followers_count === 'number' ? cr.followers_count : 0,
                is_blue_verified: cr.is_blue_verified === true,
                joined_at: typeof cr.joined_at === 'number' ? cr.joined_at : 0,
            }
        }
        xcommunity = {
            id: String(c.id),
            name: typeof c.name === 'string' ? c.name : '',
            access: typeof c.access === 'string' ? c.access : null,
            banner: typeof c.banner === 'string' ? c.banner : null,
            member_count: typeof c.member_count === 'number' ? c.member_count : 0,
            description: typeof c.description === 'string' ? c.description : null,
            created_at: typeof c.created_at === 'number' ? c.created_at : 0,
            creator,
        }
    }

    let xtype: Metadata['xtype'] = null
    if (Array.isArray(r.xtype) && r.xtype.length > 0 && typeof r.xtype[0] === 'string') {
        xtype = r.xtype as [string, ...string[]]
    }

    return {
        image: typeof r.image === 'string' ? r.image : null,
        xlink,
        website,
        telegram,
        xcommunity,
        has_socials: Boolean(xlink || telegram || website),
        xtype,
    }
}

function normalizeLastTokens(raw: unknown[]): LastToken[] {
    return raw
        .filter(item => item && typeof item === 'object')
        .map(item => {
            const r = item as Record<string, unknown>
            const fees = r.fees && typeof r.fees === 'object' ? r.fees as Record<string, unknown> : {}
            return {
                ticker:      typeof r.ticker === 'string'       ? r.ticker      : '',
                image:       typeof r.image === 'string'        ? r.image       : '',
                address:     typeof r.address === 'string'      ? r.address     : '',
                pair:        typeof r.pair === 'string'         ? r.pair        : null,
                is_migrated: typeof r.is_migrated === 'boolean' ? r.is_migrated : false,
                created_at:  typeof r.created_at === 'number'   ? r.created_at  : 0,
                dex_paid:    typeof r.dex_paid === 'boolean'    ? r.dex_paid    : false,
                fees: {
                    axiom: typeof fees.axiom === 'number' ? fees.axiom : 0,
                    gmgn:  typeof fees.gmgn === 'number'  ? fees.gmgn  : 0,
                },
                volume:      typeof r.volume === 'number'       ? r.volume      : 0,
                market_cap:  typeof r.market_cap === 'number'   ? r.market_cap  : 0,
                ath_mcap:    typeof r.ath_mcap === 'number'     ? r.ath_mcap    : 0,
            }
        })
        .slice(0, 3)
}

// --- fees filter ---

function passesFeeFilter(
    lastTokens: LastToken[],
    enabled: boolean,
    mode: 'total' | 'average' | 'each',
    threshold: number,
    feesTerminal: 'axiom' | 'gmgn',
): boolean {
    if (!enabled) return true

    const getFee = (t: LastToken) => feesTerminal === 'axiom' ? t.fees.axiom : t.fees.gmgn

    const withFees = lastTokens.filter(t => getFee(t) > 0)
    if (withFees.length === 0) return false

    if (mode === 'each') return withFees.every(t => getFee(t) >= threshold)

    const sum = withFees.reduce((acc, t) => acc + getFee(t), 0)

    if (mode === 'total') return sum >= threshold

    return (sum / withFees.length) >= threshold
}

// --- hook ---

export function useSparkTokens() {
    const { settings, isBlacklisted, isCreatorBlacklisted, isDevWhitelisted, isCreatorWhitelisted } = useSettings()
    const playSound = useNotificationSound(settings.soundEnabled, settings.soundVolume)

    // --- refs for latest settings (avoid stale closure in ws.onmessage) ---

    const playSoundRef = useRef(playSound)
    const openModeRef = useRef(settings.openMode)
    const openInBrowserRef = useRef(settings.openInBrowser)
    const terminalRef = useRef(settings.terminal)
    const filtersRef = useRef({
        devMin: settings.devMin,
        devMax: settings.devMax,
        devHoldEnabled: settings.devHoldEnabled,
        migrationPct: settings.migrationPct,
        migrationEnabled: settings.migrationEnabled,
        hideMayhem: settings.hideMayhem,
        feesFilterEnabled: settings.feesFilterEnabled,
        feesFilterMode: settings.feesFilterMode,
        feesFilterValue: settings.feesFilterValue,
        feesTerminal: settings.feesTerminal,
        communityEnabled: settings.communityEnabled,
        minCommunityMembers: settings.minCommunityMembers,
        maxCommunityMembers: settings.maxCommunityMembers,
        minCreatorFollowers: settings.minCreatorFollowers,
        maxCommunityAge: settings.maxCommunityAge,
        fundingEnabled: settings.fundingEnabled,
        minFundingAmount: settings.minFundingAmount,
        maxFundingAmount: settings.maxFundingAmount,
        maxFundingAge: settings.maxFundingAge,
    })
    const isBlacklistedRef = useRef(isBlacklisted)
    const isCreatorBlacklistedRef = useRef(isCreatorBlacklisted)
    const isDevWhitelistedRef = useRef(isDevWhitelisted)
    const isCreatorWhitelistedRef = useRef(isCreatorWhitelisted)

    useEffect(() => { playSoundRef.current = playSound }, [playSound])
    useEffect(() => { openModeRef.current = settings.openMode }, [settings.openMode])
    useEffect(() => { openInBrowserRef.current = settings.openInBrowser }, [settings.openInBrowser])
    useEffect(() => { terminalRef.current = settings.terminal }, [settings.terminal])
    useEffect(() => { isBlacklistedRef.current = isBlacklisted }, [isBlacklisted])
    useEffect(() => { isCreatorBlacklistedRef.current = isCreatorBlacklisted }, [isCreatorBlacklisted])
    useEffect(() => { isDevWhitelistedRef.current = isDevWhitelisted }, [isDevWhitelisted])
    useEffect(() => { isCreatorWhitelistedRef.current = isCreatorWhitelisted }, [isCreatorWhitelisted])
    useEffect(() => {
        filtersRef.current = {
            devMin: settings.devMin,
            devMax: settings.devMax,
            devHoldEnabled: settings.devHoldEnabled,
            migrationPct: settings.migrationPct,
            migrationEnabled: settings.migrationEnabled,
            hideMayhem: settings.hideMayhem,
            feesFilterEnabled: settings.feesFilterEnabled,
            feesFilterMode: settings.feesFilterMode,
            feesFilterValue: settings.feesFilterValue,
            feesTerminal: settings.feesTerminal,
            communityEnabled: settings.communityEnabled,
            minCommunityMembers: settings.minCommunityMembers,
            maxCommunityMembers: settings.maxCommunityMembers,
            minCreatorFollowers: settings.minCreatorFollowers,
            maxCommunityAge: settings.maxCommunityAge,
            fundingEnabled: settings.fundingEnabled,
            minFundingAmount: settings.minFundingAmount,
            maxFundingAmount: settings.maxFundingAmount,
            maxFundingAge: settings.maxFundingAge,
        }
    }, [
        settings.devMin,
        settings.devMax,
        settings.devHoldEnabled,
        settings.migrationPct,
        settings.migrationEnabled,
        settings.hideMayhem,
        settings.feesFilterEnabled,
        settings.feesFilterMode,
        settings.feesFilterValue,
        settings.feesTerminal,
        settings.communityEnabled,
        settings.minCommunityMembers,
        settings.maxCommunityMembers,
        settings.minCreatorFollowers,
        settings.maxCommunityAge,
        settings.fundingEnabled,
        settings.minFundingAmount,
        settings.maxFundingAmount,
        settings.maxFundingAge,
    ])

    // notify server when filter thresholds change
    useEffect(() => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'config',
                migration_pct: settings.migrationEnabled ? settings.migrationPct : 5,
                min_dev_hold: settings.devHoldEnabled ? settings.devMin : 0.1,
                max_dev_hold: settings.devHoldEnabled ? settings.devMax : 100,
            }))
        }
    }, [settings.migrationPct, settings.migrationEnabled, settings.devMin, settings.devMax, settings.devHoldEnabled])

    // --- internal refs ---

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectRef = useRef<number | null>(null)
    const lastPingRecvRef = useRef<number | null>(null)
    const totalProcessedRef = useRef<number>(0)

    // --- state ---

    const [status, setStatus] = useState<WsStatus>('connecting')
    const [pingMs, setPingMs] = useState<number | null>(null)
    const [tokens, setTokens] = useState<TokenCardModel[]>([])
    const [totalProcessed, setTotalProcessed] = useState<number>(0)
    const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null)

    // --- websocket ---

    const clearReconnect = () => {
        if (reconnectRef.current !== null) {
            window.clearTimeout(reconnectRef.current)
            reconnectRef.current = null
        }
    }

    const connect = (attempt = 0) => {
        clearReconnect()

        if (wsRef.current) {
            wsRef.current.onclose = null
            wsRef.current.close()
        }

        setStatus('connecting')

        const ws = new WebSocket(WS_URL)
        ws.binaryType = 'arraybuffer'
        wsRef.current = ws

        ws.onopen = () => {
            setStatus('open')
            const { migrationPct, migrationEnabled, devMin, devMax, devHoldEnabled } = filtersRef.current
            ws.send(JSON.stringify({
                type: 'config',
                migration_pct: migrationEnabled ? migrationPct : 5,
                min_dev_hold: devHoldEnabled ? devMin : 0.1,
                max_dev_hold: devHoldEnabled ? devMax : 100,
            }))
        }
        ws.onerror = () => setStatus('error')

        ws.onclose = () => {
            setStatus('closed')
            const delay =
                Math.min(WS_RECONNECT_MAX_MS, WS_RECONNECT_BASE_MS * 2 ** attempt) +
                Math.floor(Math.random() * WS_RECONNECT_JITTER_MS)
            reconnectRef.current = window.setTimeout(
                () => connect(attempt + 1),
                delay,
            )
        }

        ws.onmessage = evt => {
            let parsed: unknown
            try { parsed = decodeBinary(evt.data) } catch { return }
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

            const { newpair, dev, last_tokens, sol_price } = parsed

            // update SOL price from event
            if (typeof sol_price === 'number' && sol_price > 0) {
                setSolPriceUsd(sol_price)
            }

            // normalize metadata & last tokens early (needed for whitelist display too)
            const metadata = normalizeMetadata((newpair as unknown as Record<string, unknown>).metadata)
            const lastTokens = normalizeLastTokens(last_tokens)

            const creator = metadata?.xcommunity?.creator
            const creatorScreenName = creator?.screen_name?.toLowerCase()
            const whitelisted = isDevWhitelistedRef.current(dev.address)
                || (creatorScreenName != null && isCreatorWhitelistedRef.current(creatorScreenName))

            if (!whitelisted) {
                const {
                    devMin,
                    devMax,
                    devHoldEnabled,
                    migrationPct,
                    migrationEnabled,
                    hideMayhem,
                    feesFilterEnabled,
                    feesFilterMode,
                    feesFilterValue,
                    feesTerminal,
                    communityEnabled,
                    minCommunityMembers,
                    maxCommunityMembers,
                    minCreatorFollowers,
                    maxCommunityAge,
                    fundingEnabled,
                    minFundingAmount,
                    maxFundingAmount,
                    maxFundingAge,
                } = filtersRef.current

                // --- filters ---

                if (devHoldEnabled) {
                    if (newpair.devhold < devMin) return
                    if (newpair.devhold > devMax) return
                }
                if (migrationEnabled) {
                    if (dev.tokens.rate < migrationPct) return
                }
                if (isBlacklistedRef.current(dev.address)) return
                if (hideMayhem && newpair.is_mayhem_mode) return

                if (!passesFeeFilter(lastTokens, feesFilterEnabled, feesFilterMode, feesFilterValue, feesTerminal)) {
                    return
                }

                // funding filters
                if (fundingEnabled) {
                    if (minFundingAmount > 0) {
                        if (!dev.funding || dev.funding.amount < minFundingAmount) return
                    }
                    if (maxFundingAmount > 0) {
                        if (!dev.funding || dev.funding.amount > maxFundingAmount) return
                    }
                    if (maxFundingAge > 0 && dev.funding && dev.funding.funded_at > 0) {
                        const ageMs = Date.now() - dev.funding.funded_at
                        if (ageMs > maxFundingAge * 3_600_000) return
                    }
                }

                // community / creator filters (only apply when community is attached)
                if (metadata?.xcommunity) {
                    if (communityEnabled) {
                        if (minCommunityMembers > 0 && metadata.xcommunity.member_count < minCommunityMembers) return
                        if (maxCommunityMembers > 0 && metadata.xcommunity.member_count > maxCommunityMembers) return
                        if (minCreatorFollowers > 0 && metadata.xcommunity.creator) {
                            if (metadata.xcommunity.creator.followers_count < minCreatorFollowers) return
                        }
                        if (maxCommunityAge > 0 && metadata.xcommunity.created_at > 0) {
                            const ageMs = Date.now() - metadata.xcommunity.created_at
                            if (ageMs > maxCommunityAge * 3_600_000) return
                        }
                    }
                    if (metadata.xcommunity.creator?.screen_name) {
                        if (isCreatorBlacklistedRef.current(metadata.xcommunity.creator.screen_name)) return
                    }
                }
            }

            // --- passed all filters (or whitelisted) ---

            playSoundRef.current()
            totalProcessedRef.current += 1
            setTotalProcessed(totalProcessedRef.current)

            const pair = newpair.pair
            const id = newpair.address

            if (openInBrowserRef.current) {
                const url = terminalUrl(id, pair, terminalRef.current, openModeRef.current)

                if (openModeRef.current === 'current-tab') {
                    void invoke('set_open_url', { url })
                } else {
                    void openUrl(url)
                }
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
                metadata,
            }

            setTokens(prev => {
                const rest = prev.filter(x => x.id !== id)
                const item: TokenCardModel = {
                    id,
                    token: tokenEvent,
                    dev,
                    lastTokens,
                }
                return [item, ...rest].slice(0, MAX_TOKENS)
            })
        }
    }

    // --- lifecycle ---

    useEffect(() => {
        connect(0)

        return () => {
            clearReconnect()
            if (wsRef.current) {
                wsRef.current.onclose = null
                wsRef.current.close()
                wsRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        status,
        pingMs,
        tokens,
        totalProcessed,
        solPriceUsd,
        clearTokens: () => setTokens([]),
    }
}
