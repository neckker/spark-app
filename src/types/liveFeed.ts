export const SCHEMA_VERSION = 4
export const PRESET_COUNT = 3

export type Terminal = 'axiom' | 'padre' | 'gmgn'
export type FeesMode = 'total' | 'average' | 'each'
export type FeesSource = 'axiom' | 'gmgn'

export interface DevHoldFilter {
    enabled: boolean
    min: number
    max: number
}

export interface MigrationFilter {
    enabled: boolean
    pct: number
    requireLastMigrated: boolean
}

export interface FundingFilter {
    enabled: boolean
    amountMin: number | null
    amountMax: number | null
    ageMinHours: number | null
    ageMaxHours: number | null
}

export interface FeesFilter {
    enabled: boolean
    mode: FeesMode
    minSol: number
    source: FeesSource
}

export interface Filters {
    showPump: boolean
    showBonk: boolean
    showMayhem: boolean

    requireSocials: boolean

    devHold: DevHoldFilter
    migration: MigrationFilter
    funding: FundingFilter
    fees: FeesFilter
}

export interface Preset {
    filters: Filters
}

export interface AppSettings {
    terminal: Terminal

    openInBrowser: boolean

    soundEnabled: boolean
    soundVolume: number

    uiScale: number
}

export type TrackerList = 'whitelist' | 'blacklist' | null

export interface Tracker {
    address: string
    label: string | null
    list: TrackerList
    createdAt: number
}

export interface LiveFeedConfig {
    schema_version: number
    app: AppSettings
    presets: Preset[]
    activePresetIndex: number
    trackers: Record<string, Tracker>
}
