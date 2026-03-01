import React, { createContext, useContext, useEffect, useCallback, useState } from 'react'
import { LazyStore } from '@tauri-apps/plugin-store'

// ─── types ────────────────────────────────────────────────────────────────────

export type Terminal = 'axiom' | 'padre' | 'gmgn'
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
    soundEnabled: true,
    soundVolume: 70,
    minCommunityMembers: 0,
    maxCommunityMembers: 0,
    minCreatorFollowers: 0,
    maxCommunityAge: 0,
}

/** address → human label (до 10 символов) */
export type WalletLabels = Record<string, string>

/** creator_id → custom display name */
export type CreatorLabels = Record<string, string>

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
    setCreatorLabel: (creatorId: string, label: string) => Promise<void>
    removeCreatorLabel: (creatorId: string) => Promise<void>

    // blacklist
    blacklist: Set<string>
    addToBlacklist: (address: string) => Promise<void>
    removeFromBlacklist: (address: string) => Promise<void>
    isBlacklisted: (address: string) => boolean
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
})

// ─── provider ────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [store]       = useState(() => new LazyStore('settings.json'))
    const [settings, setSettings]           = useState<Settings>(DEFAULT_SETTINGS)
    const [walletLabels, setWalletLabels]   = useState<WalletLabels>({})
    const [creatorLabels, setCreatorLabels] = useState<CreatorLabels>({})
    const [blacklist, setBlacklist]         = useState<Set<string>>(new Set())
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
            const soundEnabled          = (await store.get<boolean>('soundEnabled'))         ?? DEFAULT_SETTINGS.soundEnabled
            const soundVolume           = (await store.get<number>('soundVolume'))            ?? DEFAULT_SETTINGS.soundVolume
            const minCommunityMembers   = (await store.get<number>('minCommunityMembers'))   ?? DEFAULT_SETTINGS.minCommunityMembers
            const maxCommunityMembers   = (await store.get<number>('maxCommunityMembers'))   ?? DEFAULT_SETTINGS.maxCommunityMembers
            const minCreatorFollowers   = (await store.get<number>('minCreatorFollowers'))   ?? DEFAULT_SETTINGS.minCreatorFollowers
            const maxCommunityAge       = (await store.get<number>('maxCommunityAge'))       ?? DEFAULT_SETTINGS.maxCommunityAge
            const rawLabels             = (await store.get<WalletLabels>('walletLabels'))    ?? {}
            const rawCreatorLabels   = (await store.get<CreatorLabels>('creatorLabels')) ?? {}
            const rawBlacklist       = (await store.get<string[]>('blacklist'))          ?? []

            setSettings({
                devMin, devMax, migrationPct, minAvgAthMcap,
                openInBrowser, openMode, terminal, uiScale,
                hideMayhem, feesFilterEnabled, feesFilterMode, feesFilterValue,
                soundEnabled, soundVolume,
                minCommunityMembers, maxCommunityMembers, minCreatorFollowers, maxCommunityAge,
            })
            setWalletLabels(rawLabels)
            setCreatorLabels(rawCreatorLabels)
            setBlacklist(new Set(rawBlacklist))
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

    const setCreatorLabel = async (creatorId: string, label: string) => {
        const trimmed = label.trim().slice(0, 16)
        const next = { ...creatorLabels, [creatorId]: trimmed }
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

    return (
        <SettingsContext.Provider value={{
            settings, store, ready, patch,
            walletLabels, setWalletLabel, removeWalletLabel,
            creatorLabels, setCreatorLabel, removeCreatorLabel,
            blacklist, addToBlacklist, removeFromBlacklist, isBlacklisted,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    return useContext(SettingsContext)
}
