import type { TokenCardModel } from '@/hooks/useTokenAnalyzer'

const HISTORY_KEY = 'spark.live.history.v1'
const HISTORY_VERSION = 1
const MAX_TOKENS = 10

interface HistoryBlob {
    version: number
    tokens: TokenCardModel[]
    solPriceUsd: number | null
    savedAt: number
}

interface LoadedHistory {
    tokens: TokenCardModel[]
    solPriceUsd: number | null
}

const EMPTY: LoadedHistory = { tokens: [], solPriceUsd: null }

export function loadHistory(): LoadedHistory {
    try {
        const raw = localStorage.getItem(HISTORY_KEY)
        if (!raw) return EMPTY
        const parsed = JSON.parse(raw) as Partial<HistoryBlob>
        if (parsed.version !== HISTORY_VERSION) return EMPTY
        if (!Array.isArray(parsed.tokens)) return EMPTY

        const tokens = parsed.tokens
            .filter(isPlausibleTokenCard)
            .slice(0, MAX_TOKENS)

        return {
            tokens,
            solPriceUsd: typeof parsed.solPriceUsd === 'number' && parsed.solPriceUsd > 0
                ? parsed.solPriceUsd
                : null
        }
    } catch {
        return EMPTY
    }
}

export function saveHistory(
    tokens: TokenCardModel[],
    solPriceUsd: number | null
): void {
    try {
        const blob: HistoryBlob = {
            version: HISTORY_VERSION,
            tokens: tokens.slice(0, MAX_TOKENS),
            solPriceUsd,
            savedAt: Date.now()
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(blob))
    } catch {
    }
}

export function clearHistory(): void {
    try {
        localStorage.removeItem(HISTORY_KEY)
    } catch {
    }
}

const ENABLED_KEY = 'spark.live.enabled.v1'

export function loadFeedEnabled(): boolean {
    try {
        return localStorage.getItem(ENABLED_KEY) === '1'
    } catch {
        return false
    }
}

export function saveFeedEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
    } catch {
    }
}

function isPlausibleTokenCard(x: unknown): x is TokenCardModel {
    if (!x || typeof x !== 'object') return false
    const v = x as Record<string, unknown>
    return typeof v.id === 'string'
        && typeof v.token === 'object'
        && typeof v.dev === 'object'
        && Array.isArray(v.lastTokens)
}
