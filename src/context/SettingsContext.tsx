import React, { createContext, useContext, useEffect, useState } from 'react'
import { LazyStore } from '@tauri-apps/plugin-store'

// --- types ---

export interface Settings {
    devMin: number
    devMax: number
    migrationPct: number
    openInBrowser: boolean
}

export const DEFAULT_SETTINGS: Settings = {
    devMin: 0,
    devMax: 100,
    migrationPct: 0,
    openInBrowser: false
}

interface SettingsCtx {
    settings: Settings
    store: LazyStore | null
    ready: boolean
    /** Обновить одно поле и сразу записать в store */
    patch: (partial: Partial<Settings>) => Promise<void>
}

// --- context ---

const SettingsContext = createContext<SettingsCtx>({
    settings: DEFAULT_SETTINGS,
    store: null,
    ready: false,
    patch: async () => {}
})

// --- provider ---

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [store] = useState(() => new LazyStore('settings.json'))
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        async function load() {
            const devMin =
                (await store.get<number>('devMin')) ?? DEFAULT_SETTINGS.devMin
            const devMax =
                (await store.get<number>('devMax')) ?? DEFAULT_SETTINGS.devMax
            const migrationPct =
                (await store.get<number>('migrationPct')) ??
                DEFAULT_SETTINGS.migrationPct
            const openInBrowser =
                (await store.get<boolean>('openInBrowser')) ??
                DEFAULT_SETTINGS.openInBrowser

            setSettings({ devMin, devMax, migrationPct, openInBrowser })
            setReady(true)
        }

        load().catch(() => setReady(true))
    }, [store])

    const patch = async (partial: Partial<Settings>) => {
        const next = { ...settings, ...partial }
        setSettings(next)

        for (const [k, v] of Object.entries(partial)) {
            await store.set(k, v)
        }
        await store.save()
    }

    return (
        <SettingsContext.Provider value={{ settings, store, ready, patch }}>
            {children}
        </SettingsContext.Provider>
    )
}

// --- hook ---

export function useSettings() {
    return useContext(SettingsContext)
}
