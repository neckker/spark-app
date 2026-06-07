import {
    PRESET_COUNT,
    SCHEMA_VERSION,
    type AppSettings,
    type Filters,
    type LiveFeedConfig,
    type Preset,
    type Terminal
} from '@/types/liveFeed'

export const DEFAULT_FILTERS: Filters = {
    showPump: true,
    showBonk: true,
    showMayhem: true,

    requireSocials: false,

    devHold: { enabled: false, min: 0.1, max: 77 },
    migration: { enabled: false, pct: 30, requireLastMigrated: false },
    funding: {
        enabled: false,
        amountMin: null,
        amountMax: null,
        ageMinHours: null,
        ageMaxHours: null
    },
    fees: {
        enabled: false,
        mode: 'average',
        minSol: 3,
        source: 'axiom'
    }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
    terminal: 'axiom',
    openInBrowser: false,
    soundEnabled: true,
    soundVolume: 50,
    uiScale: 100
}

const TERMINALS: readonly Terminal[] = ['axiom', 'padre', 'gmgn']

const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, n))

export function normalizeApp(raw: unknown): AppSettings {
    const a = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppSettings>
    const base = DEFAULT_APP_SETTINGS

    const num = (v: unknown, fallback: number, lo: number, hi: number) =>
        typeof v === 'number' && Number.isFinite(v)
            ? clamp(Math.round(v), lo, hi)
            : fallback

    return {
        terminal: TERMINALS.includes(a.terminal as Terminal)
            ? (a.terminal as Terminal)
            : base.terminal,
        openInBrowser: typeof a.openInBrowser === 'boolean'
            ? a.openInBrowser
            : base.openInBrowser,
        soundEnabled: typeof a.soundEnabled === 'boolean'
            ? a.soundEnabled
            : base.soundEnabled,
        soundVolume: num(a.soundVolume, base.soundVolume, 0, 100),
        uiScale: num(a.uiScale, base.uiScale, 75, 150)
    }
}

export function defaultPresets(): Preset[] {
    return Array.from({ length: PRESET_COUNT }, () => ({
        filters: structuredClone(DEFAULT_FILTERS)
    }))
}

export function defaultConfig(): LiveFeedConfig {
    return {
        schema_version: SCHEMA_VERSION,
        app: { ...DEFAULT_APP_SETTINGS },
        presets: defaultPresets(),
        activePresetIndex: 0,
        trackers: {}
    }
}
