import React, { createContext, useContext, useEffect, useCallback, useState } from 'react'
import { LazyStore } from '@tauri-apps/plugin-store'

// ─── types ────────────────────────────────────────────────────────────────────

export type Terminal = 'axiom' | 'padre' | 'gmgn'
export type FeesTerminal = 'axiom' | 'gmgn'
export type OpenMode = 'new-tab' | 'current-tab'
export type FeesFilterMode = 'total' | 'average' | 'each'

export interface Settings {
    devMin: number
    devMax: number
    devHoldEnabled: boolean
    migrationPct: number
    migrationEnabled: boolean
    lastTokenMigrated: boolean
    openInBrowser: boolean
    terminal: Terminal
    uiScale: number
    openMode: OpenMode
    // protocol filters (true = show, false = hide)
    showPump: boolean
    showMayhem: boolean
    showBonk: boolean
    feesFilterEnabled: boolean
    feesFilterMode: FeesFilterMode
    feesFilterValue: number
    feesTerminal: FeesTerminal
    // funding filters
    fundingEnabled: boolean
    minFundingAmount: number  // SOL, 0 = disabled
    maxFundingAmount: number  // SOL, 0 = disabled
    maxFundingAge: number     // hours, 0 = disabled
    // sound notifications
    soundEnabled: boolean
    soundVolume: number // 0-100
    // community filters
    communityEnabled: boolean
    onlyCommunity: boolean
    minCommunityMembers: number
    maxCommunityMembers: number
    minCreatorFollowers: number
    maxCreatorFollowers: number
    maxCommunityAge: number // hours, 0 = disabled
    maxCreatorAge: number   // hours, 0 = disabled
}

export const DEFAULT_SETTINGS: Settings = {
    devMin: 0.1,
    devMax: 77,
    devHoldEnabled: true,
    migrationPct: 15,
    migrationEnabled: true,
    lastTokenMigrated: false,
    openInBrowser: false,
    openMode: 'new-tab',
    terminal: 'axiom',
    uiScale: 100,
    showPump: true,
    showMayhem: true,
    showBonk: true,
    feesFilterEnabled: false,
    feesFilterMode: 'total',
    feesFilterValue: 1,
    feesTerminal: 'axiom',
    fundingEnabled: false,
    minFundingAmount: 0,
    maxFundingAmount: 0,
    maxFundingAge: 0,
    soundEnabled: true,
    soundVolume: 70,
    communityEnabled: false,
    onlyCommunity: false,
    minCommunityMembers: 0,
    maxCommunityMembers: 0,
    minCreatorFollowers: 0,
    maxCreatorFollowers: 0,
    maxCommunityAge: 0,
    maxCreatorAge: 0,
}

// ─── store structure ─────────────────────────────────────────────────────────

type StoreApp = {
    openInBrowser: boolean
    openMode: OpenMode
    terminal: Terminal
    uiScale: number
    soundEnabled: boolean
    soundVolume: number
}

type StoreFilters = {
    devHold: { devMin: number; devMax: number; devHoldEnabled: boolean }
    migration: { migrationPct: number; migrationEnabled: boolean; lastTokenMigrated: boolean }
    protocols: { showPump: boolean; showMayhem: boolean; showBonk: boolean }
    fees: { feesFilterEnabled: boolean; feesFilterMode: FeesFilterMode; feesFilterValue: number; feesTerminal: FeesTerminal }
    funding: { fundingEnabled: boolean; minFundingAmount: number; maxFundingAmount: number; maxFundingAge: number }
    community: { communityEnabled: boolean; onlyCommunity: boolean; minCommunityMembers: number; maxCommunityMembers: number; minCreatorFollowers: number; maxCreatorFollowers: number; maxCommunityAge: number; maxCreatorAge: number }
}

export type StoreLabels = {
    wallets: WalletLabels
    creators: CreatorLabels
}

export type StoreBlacklist = {
    wallets: string[]
    creators: CreatorBlacklist
}

export type StoreWhitelist = {
    wallets: string[]
    creators: CreatorBlacklist
}

/** address → human label (до 10 символов) */
export type WalletLabels = Record<string, string>

/** creator label data with color and screen name */
export type CreatorLabelData = {
    label: string
    color: string
    screenName: string
}

/** creator_id → label data */
export type CreatorLabels = Record<string, CreatorLabelData>

/** creator_id → screen_name (for display in blacklist) */
export type CreatorBlacklist = Record<string, string>

// ─── helpers ─────────────────────────────────────────────────────────────────

function settingsToApp(s: Settings): StoreApp {
    return {
        openInBrowser: s.openInBrowser, openMode: s.openMode,
        terminal: s.terminal, uiScale: s.uiScale,
        soundEnabled: s.soundEnabled, soundVolume: s.soundVolume,
    }
}

function settingsToFilters(s: Settings): StoreFilters {
    return {
        devHold: { devMin: s.devMin, devMax: s.devMax, devHoldEnabled: s.devHoldEnabled },
        migration: { migrationPct: s.migrationPct, migrationEnabled: s.migrationEnabled, lastTokenMigrated: s.lastTokenMigrated },
        protocols: { showPump: s.showPump, showMayhem: s.showMayhem, showBonk: s.showBonk },
        fees: { feesFilterEnabled: s.feesFilterEnabled, feesFilterMode: s.feesFilterMode, feesFilterValue: s.feesFilterValue, feesTerminal: s.feesTerminal },
        funding: { fundingEnabled: s.fundingEnabled, minFundingAmount: s.minFundingAmount, maxFundingAmount: s.maxFundingAmount, maxFundingAge: s.maxFundingAge },
        community: { communityEnabled: s.communityEnabled, onlyCommunity: s.onlyCommunity, minCommunityMembers: s.minCommunityMembers, maxCommunityMembers: s.maxCommunityMembers, minCreatorFollowers: s.minCreatorFollowers, maxCreatorFollowers: s.maxCreatorFollowers, maxCommunityAge: s.maxCommunityAge, maxCreatorAge: s.maxCreatorAge },
    }
}

function appToSettings(a: StoreApp): Partial<Settings> {
    return { ...a }
}

function filtersToSettings(f: StoreFilters): Partial<Settings> {
    return { ...f.devHold, ...f.migration, ...f.protocols, ...f.fees, ...f.funding, ...f.community }
}

// ─── context ─────────────────────────────────────────────────────────────────

interface SettingsCtx {
    settings: Settings
    store: LazyStore | null
    ready: boolean
    patch: (partial: Partial<Settings>) => Promise<void>

    // wallet labels
    walletLabels: WalletLabels
    setWalletLabel: (address: string, label: string) => Promise<void>
    removeWalletLabel: (address: string) => Promise<void>

    // creator labels (community creators, keyed by screenName)
    creatorLabels: CreatorLabels
    setCreatorLabel: (screenName: string, label: string, color: string) => Promise<void>
    removeCreatorLabel: (screenName: string) => Promise<void>

    // wallet blacklist
    blacklist: Set<string>
    addToBlacklist: (address: string) => Promise<void>
    removeFromBlacklist: (address: string) => Promise<void>
    isBlacklisted: (address: string) => boolean

    // creator blacklist (keyed by screenName)
    creatorBlacklist: CreatorBlacklist
    addCreatorToBlacklist: (screenName: string) => Promise<void>
    removeCreatorFromBlacklist: (screenName: string) => Promise<void>
    isCreatorBlacklisted: (screenName: string) => boolean

    // dev whitelist (wallets)
    devWhitelist: Set<string>
    addToDevWhitelist: (address: string) => Promise<void>
    removeFromDevWhitelist: (address: string) => Promise<void>
    isDevWhitelisted: (address: string) => boolean

    // creator whitelist (keyed by screenName)
    creatorWhitelist: CreatorBlacklist  // reuse same shape: screenName → displayName
    addCreatorToWhitelist: (screenName: string) => Promise<void>
    removeCreatorFromWhitelist: (screenName: string) => Promise<void>
    isCreatorWhitelisted: (screenName: string) => boolean
}

const SettingsContext = createContext<SettingsCtx>({
    settings: DEFAULT_SETTINGS,
    store: null,
    ready: false,
    patch: async () => {},
    walletLabels: {},
    setWalletLabel: async () => {},
    removeWalletLabel: async () => {},
    creatorLabels: {},
    setCreatorLabel: async () => { },
    removeCreatorLabel: async () => { },
    blacklist: new Set(),
    addToBlacklist: async () => {},
    removeFromBlacklist: async () => {},
    isBlacklisted: () => false,
    creatorBlacklist: {},
    addCreatorToBlacklist: async () => {},
    removeCreatorFromBlacklist: async () => {},
    isCreatorBlacklisted: () => false,
    devWhitelist: new Set(),
    addToDevWhitelist: async () => {},
    removeFromDevWhitelist: async () => {},
    isDevWhitelisted: () => false,
    creatorWhitelist: {},
    addCreatorToWhitelist: async () => {},
    removeCreatorFromWhitelist: async () => {},
    isCreatorWhitelisted: () => false,
})

// ─── provider ────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [store]       = useState(() => new LazyStore('settings.json'))
    const [settings, setSettings]           = useState<Settings>(DEFAULT_SETTINGS)
    const [walletLabels, setWalletLabels]   = useState<WalletLabels>({})
    const [creatorLabels, setCreatorLabels] = useState<CreatorLabels>({})
    const [blacklist, setBlacklist]         = useState<Set<string>>(new Set())
    const [creatorBlacklist, setCreatorBlacklist] = useState<CreatorBlacklist>({})
    const [devWhitelist, setDevWhitelist]   = useState<Set<string>>(new Set())
    const [creatorWhitelist, setCreatorWhitelist] = useState<CreatorBlacklist>({})
    const [ready, setReady]                 = useState(false)

    useEffect(() => {
        async function load() {
            // Читаем только актуальную категоризированную структуру.
            // Любые посторонние ключи (включая реликты старой плоской схемы)
            // игнорируются — на работу это не влияет, а лишней логики меньше.
            const storedApp     = await store.get<StoreApp>('app')
            const storedFilters = await store.get<StoreFilters>('filters')
            const storedLabels  = await store.get<StoreLabels>('labels')
            const storedBL      = await store.get<StoreBlacklist>('blacklist')
            const storedWL      = await store.get<StoreWhitelist>('whitelist')

            const resolved: Settings = {
                ...DEFAULT_SETTINGS,
                ...(storedApp ? appToSettings(storedApp) : {}),
                ...(storedFilters ? filtersToSettings(storedFilters) : {}),
            }

            setSettings(resolved)
            setWalletLabels(storedLabels?.wallets ?? {})
            setCreatorLabels(storedLabels?.creators ?? {})
            setBlacklist(new Set(storedBL?.wallets ?? []))
            setCreatorBlacklist(storedBL?.creators ?? {})
            setDevWhitelist(new Set(storedWL?.wallets ?? []))
            setCreatorWhitelist(storedWL?.creators ?? {})
            setReady(true)
        }
        load().catch(() => setReady(true))
    }, [store])

    // ── settings patch ──

    const patch = async (partial: Partial<Settings>) => {
        const next = { ...settings, ...partial }
        setSettings(next)
        await store.set('app', settingsToApp(next))
        await store.set('filters', settingsToFilters(next))
        await store.save()
    }

    // ── labels ──

    const saveLabels = async (wl: WalletLabels, cl: CreatorLabels) => {
        await store.set('labels', { wallets: wl, creators: cl })
        await store.save()
    }

    const setWalletLabel = async (address: string, label: string) => {
        const trimmed = label.trim().slice(0, 10)
        const { [address]: _, ...rest } = walletLabels
        const next = { [address]: trimmed, ...rest }
        setWalletLabels(next)
        await saveLabels(next, creatorLabels)
    }

    const removeWalletLabel = async (address: string) => {
        const next = { ...walletLabels }
        delete next[address]
        setWalletLabels(next)
        await saveLabels(next, creatorLabels)
    }

    const setCreatorLabel = async (screenName: string, label: string, color: string) => {
        const key = screenName.toLowerCase()
        const trimmed = label.trim().slice(0, 16)
        const data: CreatorLabelData = { label: trimmed, color, screenName }
        const { [key]: _, ...rest } = creatorLabels
        const next = { [key]: data, ...rest }
        setCreatorLabels(next)
        await saveLabels(walletLabels, next)
    }

    const removeCreatorLabel = async (screenName: string) => {
        const next = { ...creatorLabels }
        delete next[screenName.toLowerCase()]
        setCreatorLabels(next)
        await saveLabels(walletLabels, next)
    }

    // ── blacklist ──

    const saveBlacklist = async (wl: string[], cl: CreatorBlacklist) => {
        await store.set('blacklist', { wallets: wl, creators: cl })
        await store.save()
    }

    const addToBlacklist = async (address: string) => {
        const next = new Set([address, ...blacklist])
        setBlacklist(next)
        await saveBlacklist([...next], creatorBlacklist)
    }

    const removeFromBlacklist = async (address: string) => {
        const next = new Set(blacklist)
        next.delete(address)
        setBlacklist(next)
        await saveBlacklist([...next], creatorBlacklist)
    }

    const isBlacklisted = useCallback(
        (address: string) => blacklist.has(address),
        [blacklist]
    )

    const addCreatorToBlacklist = async (screenName: string) => {
        const key = screenName.toLowerCase()
        const { [key]: _, ...rest } = creatorBlacklist
        const next = { [key]: screenName, ...rest }
        setCreatorBlacklist(next)
        await saveBlacklist([...blacklist], next)
    }

    const removeCreatorFromBlacklist = async (screenName: string) => {
        const next = { ...creatorBlacklist }
        delete next[screenName.toLowerCase()]
        setCreatorBlacklist(next)
        await saveBlacklist([...blacklist], next)
    }

    const isCreatorBlacklisted = useCallback(
        (screenName: string) => screenName.toLowerCase() in creatorBlacklist,
        [creatorBlacklist]
    )

    // ── whitelist ──

    const saveWhitelist = async (wl: string[], cl: CreatorBlacklist) => {
        await store.set('whitelist', { wallets: wl, creators: cl })
        await store.save()
    }

    const addToDevWhitelist = async (address: string) => {
        const next = new Set([address, ...devWhitelist])
        setDevWhitelist(next)
        await saveWhitelist([...next], creatorWhitelist)
    }

    const removeFromDevWhitelist = async (address: string) => {
        const next = new Set(devWhitelist)
        next.delete(address)
        setDevWhitelist(next)
        await saveWhitelist([...next], creatorWhitelist)
    }

    const isDevWhitelisted = useCallback(
        (address: string) => devWhitelist.has(address),
        [devWhitelist]
    )

    const addCreatorToWhitelist = async (screenName: string) => {
        const key = screenName.toLowerCase()
        const { [key]: _, ...rest } = creatorWhitelist
        const next = { [key]: screenName, ...rest }
        setCreatorWhitelist(next)
        await saveWhitelist([...devWhitelist], next)
    }

    const removeCreatorFromWhitelist = async (screenName: string) => {
        const next = { ...creatorWhitelist }
        delete next[screenName.toLowerCase()]
        setCreatorWhitelist(next)
        await saveWhitelist([...devWhitelist], next)
    }

    const isCreatorWhitelisted = useCallback(
        (screenName: string) => screenName.toLowerCase() in creatorWhitelist,
        [creatorWhitelist]
    )

    return (
        <SettingsContext.Provider value={{
            settings, store, ready, patch,
            walletLabels, setWalletLabel, removeWalletLabel,
            creatorLabels, setCreatorLabel, removeCreatorLabel,
            blacklist, addToBlacklist, removeFromBlacklist, isBlacklisted,
            creatorBlacklist, addCreatorToBlacklist, removeCreatorFromBlacklist, isCreatorBlacklisted,
            devWhitelist, addToDevWhitelist, removeFromDevWhitelist, isDevWhitelisted,
            creatorWhitelist, addCreatorToWhitelist, removeCreatorFromWhitelist, isCreatorWhitelisted,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    return useContext(SettingsContext)
}
