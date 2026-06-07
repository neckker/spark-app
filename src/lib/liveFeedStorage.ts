import {
    PRESET_COUNT,
    SCHEMA_VERSION,
    type Filters,
    type LiveFeedConfig
} from '@/types/liveFeed'
import { defaultConfig, defaultPresets, normalizeApp } from './liveFeedDefaults'

const STORAGE_KEY = 'spark.live.v1'

export function loadConfig(): LiveFeedConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return defaultConfig()
        const parsed = JSON.parse(raw) as Partial<LiveFeedConfig>
        return _migrate(parsed)
    } catch {
        return defaultConfig()
    }
}

export function saveConfig(cfg: LiveFeedConfig): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
    } catch {
    }
}

function _migrate(stored: Partial<LiveFeedConfig>): LiveFeedConfig {
    const base = defaultConfig()

    const sameSchema = stored.schema_version === SCHEMA_VERSION

    const presets =
        sameSchema
        && Array.isArray(stored.presets)
        && stored.presets.length === PRESET_COUNT
            ? stored.presets.map((p, i) => ({
                  filters: mergeFilters(base.presets[i].filters, p?.filters)
              }))
            : defaultPresets()

    const activePresetIndex =
        sameSchema
        && typeof stored.activePresetIndex === 'number'
        && stored.activePresetIndex >= 0
        && stored.activePresetIndex < PRESET_COUNT
            ? stored.activePresetIndex
            : 0

    return {
        schema_version: SCHEMA_VERSION,
        app: normalizeApp(stored.app),
        presets,
        activePresetIndex,
        trackers: { ...base.trackers, ...(stored.trackers ?? {}) }
    }
}

function mergeFilters(base: Filters, user: unknown): Filters {
    const u = (user && typeof user === 'object' ? user : {}) as Partial<Filters>
    return {
        ...base,
        ...u,
        devHold: { ...base.devHold, ...(u.devHold ?? {}) },
        migration: { ...base.migration, ...(u.migration ?? {}) },
        funding: { ...base.funding, ...(u.funding ?? {}) },
        fees: { ...base.fees, ...(u.fees ?? {}) }
    }
}
