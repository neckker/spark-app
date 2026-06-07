import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode
} from 'react'
import toast from 'react-hot-toast'
import { useDebouncedCallback } from 'use-debounce'

import {
    PRESET_COUNT,
    type AppSettings,
    type Filters,
    type LiveFeedConfig,
    type Tracker,
    type TrackerList
} from '@/types/liveFeed'
import { defaultConfig } from '@/lib/liveFeedDefaults'
import { loadConfig, saveConfig } from '@/lib/liveFeedStorage'

function keyOf(address: string): string {
    return address.trim().toLowerCase()
}

interface TokenAnalyzerCtx {
    ready: boolean

    config: LiveFeedConfig
    activeFilters: Filters

    setApp: (patch: Partial<AppSettings>, debounceToast?: boolean) => void

    setActivePresetIndex: (index: number) => void
    updatePresetFilters: (index: number, patch: Partial<Filters>) => void

    upsertTracker: (
        address: string,
        patch: { label?: string | null; list?: TrackerList }
    ) => void
    removeTracker: (address: string) => void

    isWhitelistedDev: (address: string) => boolean
    isBlacklistedDev: (address: string) => boolean

    replaceConfig: (cfg: LiveFeedConfig) => void
}

const Ctx = createContext<TokenAnalyzerCtx | null>(null)

export function TokenAnalyzerProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<LiveFeedConfig>(() => defaultConfig())
    const [ready, setReady] = useState(false)

    useEffect(() => {
        setConfig(loadConfig())
        setReady(true)
    }, [])

    useEffect(() => {
        if (!ready) return
        saveConfig(config)
    }, [ready, config])

    const update = useCallback((mut: (draft: LiveFeedConfig) => LiveFeedConfig) => {
        setConfig((prev) => mut(prev))
    }, [])

    const notifySaved = useCallback(() => {
        toast.success('Settings saved')
    }, [])

    const notifySavedDebounced = useDebouncedCallback(() => {
        toast.success('Settings saved')
    }, 300)

    const setApp = useCallback(
        (patch: Partial<AppSettings>, debounceToast = false) => {
            update((prev) => ({ ...prev, app: { ...prev.app, ...patch } }))
            if (debounceToast) notifySavedDebounced()
            else notifySaved()
        },
        [update, notifySaved, notifySavedDebounced]
    )

    const setActivePresetIndex = useCallback((index: number) => {
        if (index < 0 || index >= PRESET_COUNT) return
        update((prev) => ({ ...prev, activePresetIndex: index }))
    }, [update])

    const updatePresetFilters = useCallback(
        (index: number, patch: Partial<Filters>) => {
            if (index < 0 || index >= PRESET_COUNT) return
            update((prev) => ({
                ...prev,
                presets: prev.presets.map((p, i) =>
                    i === index
                        ? { ...p, filters: { ...p.filters, ...patch } }
                        : p
                )
            }))
            notifySaved()
        },
        [update, notifySaved]
    )

    const upsertTracker = useCallback(
        (
            address: string,
            patch: { label?: string | null; list?: TrackerList }
        ) => {
            const key = keyOf(address)
            if (!key) return
            update((prev) => {
                const current = prev.trackers[key]
                const label = normalizeLabel(
                    patch.label !== undefined ? patch.label : current?.label ?? null
                )
                const next: Tracker = {
                    address: current?.address ?? address.trim(),
                    label: label ?? (current ? null : 'unknown'),
                    list: patch.list !== undefined ? patch.list : current?.list ?? null,
                    createdAt: current?.createdAt ?? Date.now()
                }
                return {
                    ...prev,
                    trackers: { ...prev.trackers, [key]: next }
                }
            })
        },
        [update]
    )

    const removeTracker = useCallback((address: string) => {
        const key = keyOf(address)
        if (!key) return
        update((prev) => {
            if (!prev.trackers[key]) return prev
            const next = { ...prev.trackers }
            delete next[key]
            return { ...prev, trackers: next }
        })
    }, [update])

    const replaceConfig = useCallback((cfg: LiveFeedConfig) => {
        setConfig(cfg)
    }, [])

    const activeFilters = useMemo<Filters>(() => {
        const preset = config.presets[config.activePresetIndex]
            ?? config.presets[0]
        return preset.filters
    }, [config.activePresetIndex, config.presets])

    const isWhitelistedDev = useCallback(
        (address: string) => config.trackers[keyOf(address)]?.list === 'whitelist',
        [config.trackers]
    )

    const isBlacklistedDev = useCallback(
        (address: string) => config.trackers[keyOf(address)]?.list === 'blacklist',
        [config.trackers]
    )

    const value = useMemo<TokenAnalyzerCtx>(
        () => ({
            ready,
            config,
            activeFilters,
            setApp,
            setActivePresetIndex,
            updatePresetFilters,
            upsertTracker,
            removeTracker,
            isWhitelistedDev,
            isBlacklistedDev,
            replaceConfig
        }),
        [
            ready,
            config,
            activeFilters,
            setApp,
            setActivePresetIndex,
            updatePresetFilters,
            upsertTracker,
            removeTracker,
            isWhitelistedDev,
            isBlacklistedDev,
            replaceConfig
        ]
    )

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTokenAnalyzer(): TokenAnalyzerCtx {
    const ctx = useContext(Ctx)
    if (!ctx) {
        throw new Error('useTokenAnalyzer must be used inside TokenAnalyzerProvider')
    }
    return ctx
}

function normalizeLabel(raw: string | null): string | null {
    if (raw === null) return null
    const trimmed = raw.trim().slice(0, 16)
    return trimmed ? trimmed : null
}
