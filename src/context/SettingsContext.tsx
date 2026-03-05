import React, { createContext, useContext, useEffect, useCallback, useState } from 'react'
import { LazyStore } from '@tauri-apps/plugin-store'

// ─── types ────────────────────────────────────────────────────────────────────

export type Terminal = 'axiom' | 'padre' | 'gmgn'
export type FeesTerminal = 'axiom' | 'gmgn'
export type OpenMode = 'new-tab' | 'current-tab'
export type FeesFilterMode = 'total' | 'average'

export interface Settings {
    devMin: number
    devMax: number
    migrationPct: number
    minAvgAthMcap: number
    openInBrowser: boolean
    terminal: Terminal
    uiScale: number
    openMode: OpenMode
    // new filters
    hideMayhem: boolean
    feesFilterEnabled: boolean
    feesFilterMode: FeesFilterMode
    feesFilterValue: number
    feesTerminal: FeesTerminal
    // sound notifications
    soundEnabled: boolean
    soundVolume: number // 0-100
    // community filters
    minCommunityMembers: number
    maxCommunityMembers: number
    minCreatorFollowers: number
    maxCommunityAge: number // hours, 0 = disabled
}

export const DEFAULT_SETTINGS: Settings = {
    devMin: 0.1,
    devMax: 77,
    migrationPct: 15,
    minAvgAthMcap: 0,
    openInBrowser: false,
    openMode: 'new-tab',
    terminal: 'axiom',
    uiScale: 100,
    hideMayhem: false,
    feesFilterEnabled: false,
    feesFilterMode: 'total',
    feesFilterValue: 1,
    feesTerminal: 'axiom',
    soundEnabled: true,
    soundVolume: 70,
    minCommunityMembers: 0,
    maxCommunityMembers: 0,
    minCreatorFollowers: 0,
    maxCommunityAge: 0,
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

interface SettingsCtx {
    settings: Settings
    store: LazyStore | null
    ready: boolean
    patch: (partial: Partial<Settings>) => Promise<void>

    // wallet labels
    walletLabels: WalletLabels
    setWalletLabel: (address: string, label: string) => Promise<void>
    removeWalletLabel: (address: string) => Promise<void>

    // creator labels (community creators)
    creatorLabels: CreatorLabels
    setCreatorLabel: (creatorId: string, label: string, color: string, screenName: string) => Promise<void>
    removeCreatorLabel: (creatorId: string) => Promise<void>

    // wallet blacklist
    blacklist: Set<string>
    addToBlacklist: (address: string) => Promise<void>
    removeFromBlacklist: (address: string) => Promise<void>
    isBlacklisted: (address: string) => boolean

    // creator blacklist
    creatorBlacklist: CreatorBlacklist
    addCreatorToBlacklist: (id: string, screenName: string) => Promise<void>
    removeCreatorFromBlacklist: (id: string) => Promise<void>
    isCreatorBlacklisted: (id: string) => boolean
}

// ─── context ─────────────────────────────────────────────────────────────────

const SettingsContext = createContext<SettingsCtx>({
    settings: DEFAULT_SETTINGS,
    store: null,
    ready: false,
    patch: async () => {},
    walletLabels: {},
    setWalletLabel: async () => {},
    removeWalletLabel: async () => {},
    creatorLabels: {},
    setCreatorLabel: async () => {},
    removeCreatorLabel: async () => {},
    blacklist: new Set(),
    addToBlacklist: async () => {},
    removeFromBlacklist: async () => {},
    isBlacklisted: () => false,
    creatorBlacklist: {},
    addCreatorToBlacklist: async () => {},
    removeCreatorFromBlacklist: async () => {},
    isCreatorBlacklisted: () => false,
})

// ─── provider ────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [store]       = useState(() => new LazyStore('settings.json'))
    const [settings, setSettings]           = useState<Settings>(DEFAULT_SETTINGS)
    const [walletLabels, setWalletLabels]   = useState<WalletLabels>({})
    const [creatorLabels, setCreatorLabels] = useState<CreatorLabels>({})
    const [blacklist, setBlacklist]         = useState<Set<string>>(new Set())
    const [creatorBlacklist, setCreatorBlacklist] = useState<CreatorBlacklist>({})
    const [ready, setReady]                 = useState(false)

    useEffect(() => {
        async function load() {
            const devMin             = (await store.get<number>('devMin'))             ?? DEFAULT_SETTINGS.devMin
            const devMax             = (await store.get<number>('devMax'))             ?? DEFAULT_SETTINGS.devMax
            const migrationPct       = (await store.get<number>('migrationPct'))       ?? DEFAULT_SETTINGS.migrationPct
            const minAvgAthMcap      = (await store.get<number>('minAvgAthMcap'))     ?? DEFAULT_SETTINGS.minAvgAthMcap
            const openInBrowser      = (await store.get<boolean>('openInBrowser'))     ?? DEFAULT_SETTINGS.openInBrowser
            const openMode           = (await store.get<OpenMode>('openMode'))         ?? DEFAULT_SETTINGS.openMode
            const terminal           = (await store.get<Terminal>('terminal'))         ?? DEFAULT_SETTINGS.terminal
            const uiScale            = (await store.get<number>('uiScale'))            ?? DEFAULT_SETTINGS.uiScale
            const hideMayhem         = (await store.get<boolean>('hideMayhem'))        ?? DEFAULT_SETTINGS.hideMayhem
            const feesFilterEnabled  = (await store.get<boolean>('feesFilterEnabled')) ?? DEFAULT_SETTINGS.feesFilterEnabled
            const feesFilterMode     = (await store.get<FeesFilterMode>('feesFilterMode')) ?? DEFAULT_SETTINGS.feesFilterMode
            const feesFilterValue    = (await store.get<number>('feesFilterValue'))    ?? DEFAULT_SETTINGS.feesFilterValue
            const feesTerminal       = (await store.get<FeesTerminal>('feesTerminal'))  ?? DEFAULT_SETTINGS.feesTerminal
            const soundEnabled          = (await store.get<boolean>('soundEnabled'))         ?? DEFAULT_SETTINGS.soundEnabled
            const soundVolume           = (await store.get<number>('soundVolume'))            ?? DEFAULT_SETTINGS.soundVolume
            const minCommunityMembers   = (await store.get<number>('minCommunityMembers'))   ?? DEFAULT_SETTINGS.minCommunityMembers
            const maxCommunityMembers   = (await store.get<number>('maxCommunityMembers'))   ?? DEFAULT_SETTINGS.maxCommunityMembers
            const minCreatorFollowers   = (await store.get<number>('minCreatorFollowers'))   ?? DEFAULT_SETTINGS.minCreatorFollowers
            const maxCommunityAge       = (await store.get<number>('maxCommunityAge'))       ?? DEFAULT_SETTINGS.maxCommunityAge
            const rawLabels             = (await store.get<WalletLabels>('walletLabels'))    ?? {}
            const rawCreatorLabels   = (await store.get<Record<string, unknown>>('creatorLabels')) ?? {}
            const rawBlacklist       = (await store.get<string[]>('blacklist'))          ?? []
            const rawCreatorBlacklist = (await store.get<CreatorBlacklist>('creatorBlacklist')) ?? {}

            // Migrate old string-format creator labels to new object format
            const migratedCreatorLabels: CreatorLabels = {}
            for (const [id, value] of Object.entries(rawCreatorLabels)) {
                if (typeof value === 'string') {
                    migratedCreatorLabels[id] = { label: value, color: '#7dd3fc', screenName: '' }
                } else if (value && typeof value === 'object') {
                    migratedCreatorLabels[id] = value as CreatorLabelData
                }
            }

            setSettings({
                devMin, devMax, migrationPct, minAvgAthMcap,
                openInBrowser, openMode, terminal, uiScale,
                hideMayhem, feesFilterEnabled, feesFilterMode, feesFilterValue, feesTerminal,
                soundEnabled, soundVolume,
                minCommunityMembers, maxCommunityMembers, minCreatorFollowers, maxCommunityAge,
            })
            setWalletLabels(rawLabels)
            setCreatorLabels(migratedCreatorLabels)
            setBlacklist(new Set(rawBlacklist))
            setCreatorBlacklist(rawCreatorBlacklist)
            setReady(true)
        }
        load().catch(() => setReady(true))
    }, [store])

    const patch = async (partial: Partial<Settings>) => {
        const next = { ...settings, ...partial }
        setSettings(next)
        for (const [k, v] of Object.entries(partial)) await store.set(k, v)
        await store.save()
    }

    const setWalletLabel = async (address: string, label: string) => {
        const trimmed = label.trim().slice(0, 10)
        const next = { ...walletLabels, [address]: trimmed }
        setWalletLabels(next)
        await store.set('walletLabels', next)
        await store.save()
    }

    const removeWalletLabel = async (address: string) => {
        const next = { ...walletLabels }
        delete next[address]
        setWalletLabels(next)
        await store.set('walletLabels', next)
        await store.save()
    }

    const setCreatorLabel = async (creatorId: string, label: string, color: string, screenName: string) => {
        const trimmed = label.trim().slice(0, 16)
        const data: CreatorLabelData = { label: trimmed, color, screenName }
        const next = { ...creatorLabels, [creatorId]: data }
        setCreatorLabels(next)
        await store.set('creatorLabels', next)
        await store.save()
    }

    const removeCreatorLabel = async (creatorId: string) => {
        const next = { ...creatorLabels }
        delete next[creatorId]
        setCreatorLabels(next)
        await store.set('creatorLabels', next)
        await store.save()
    }

    const addToBlacklist = async (address: string) => {
        const next = new Set(blacklist).add(address)
        setBlacklist(next)
        await store.set('blacklist', [...next])
        await store.save()
    }

    const removeFromBlacklist = async (address: string) => {
        const next = new Set(blacklist)
        next.delete(address)
        setBlacklist(next)
        await store.set('blacklist', [...next])
        await store.save()
    }

    const isBlacklisted = useCallback(
        (address: string) => blacklist.has(address),
        [blacklist]
    )

    const addCreatorToBlacklist = async (id: string, screenName: string) => {
        const next = { ...creatorBlacklist, [id]: screenName }
        setCreatorBlacklist(next)
        await store.set('creatorBlacklist', next)
        await store.save()
    }

    const removeCreatorFromBlacklist = async (id: string) => {
        const next = { ...creatorBlacklist }
        delete next[id]
        setCreatorBlacklist(next)
        await store.set('creatorBlacklist', next)
        await store.save()
    }

    const isCreatorBlacklisted = useCallback(
        (id: string) => id in creatorBlacklist,
        [creatorBlacklist]
    )

    return (
        <SettingsContext.Provider value={{
            settings, store, ready, patch,
            walletLabels, setWalletLabel, removeWalletLabel,
            creatorLabels, setCreatorLabel, removeCreatorLabel,
            blacklist, addToBlacklist, removeFromBlacklist, isBlacklisted,
            creatorBlacklist, addCreatorToBlacklist, removeCreatorFromBlacklist, isCreatorBlacklisted,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    return useContext(SettingsContext)
}
