import React, { createContext, useContext, useEffect, useCallback, useState } from 'react'
import { LazyStore } from '@tauri-apps/plugin-store'

// ─── types ────────────────────────────────────────────────────────────────────

export type Terminal = 'axiom' | 'padre' | 'gmgn'

export interface Settings {
    devMin: number
    devMax: number
    migrationPct: number
    openInBrowser: boolean
    terminal: Terminal
}

export const DEFAULT_SETTINGS: Settings = {
    devMin: 0,
    devMax: 100,
    migrationPct: 0,
    openInBrowser: false,
    terminal: 'axiom',
}

/** address → human label (до 10 символов) */
export type WalletLabels = Record<string, string>

interface SettingsCtx {
    settings: Settings
    store: LazyStore | null
    ready: boolean
    patch: (partial: Partial<Settings>) => Promise<void>

    // wallet labels
    walletLabels: WalletLabels
    setWalletLabel: (address: string, label: string) => Promise<void>
    removeWalletLabel: (address: string) => Promise<void>

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
    blacklist: new Set(),
    addToBlacklist: async () => {},
    removeFromBlacklist: async () => {},
    isBlacklisted: () => false,
})

// ─── provider ────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [store]       = useState(() => new LazyStore('settings.json'))
    const [settings, setSettings]         = useState<Settings>(DEFAULT_SETTINGS)
    const [walletLabels, setWalletLabels] = useState<WalletLabels>({})
    const [blacklist, setBlacklist]       = useState<Set<string>>(new Set())
    const [ready, setReady]               = useState(false)

    useEffect(() => {
        async function load() {
            const devMin        = (await store.get<number>('devMin'))          ?? DEFAULT_SETTINGS.devMin
            const devMax        = (await store.get<number>('devMax'))          ?? DEFAULT_SETTINGS.devMax
            const migrationPct  = (await store.get<number>('migrationPct'))    ?? DEFAULT_SETTINGS.migrationPct
            const openInBrowser = (await store.get<boolean>('openInBrowser'))  ?? DEFAULT_SETTINGS.openInBrowser
            const terminal      = (await store.get<Terminal>('terminal'))      ?? DEFAULT_SETTINGS.terminal
            const rawLabels     = (await store.get<WalletLabels>('walletLabels')) ?? {}
            const rawBlacklist  = (await store.get<string[]>('blacklist'))        ?? []

            setSettings({ devMin, devMax, migrationPct, openInBrowser, terminal })
            setWalletLabels(rawLabels)
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
            blacklist, addToBlacklist, removeFromBlacklist, isBlacklisted,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    return useContext(SettingsContext)
}
