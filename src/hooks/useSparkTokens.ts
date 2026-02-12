import axios from 'axios'
import { useEffect, useRef, useState } from 'react'

type WsStatus = 'connecting' | 'open' | 'closed' | 'error'
type PriceStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TokenEvent = {
    address: string
    name: string
    ticker: string
    devhold: number
    protocol: 'pump' | 'bonk' | string
    metadata_url: string | null
    is_mayhem_mode: boolean
}

export type Metadata = {
    name?: string | null
    ticker?: string | null
    image_url?: string | null
    telegram?: string | null
    website?: string | null
    twitter?: string | null
    has_socials?: boolean
}

export type TokenCardModel = {
    id: string
    token: TokenEvent
    metadata: Metadata | null
    metaStatus: 'idle' | 'loading' | 'ready' | 'error'
}

type WsMessage = Record<string, unknown>

const WS_URL = 'ws://127.0.0.1:8000/hub/ws'
const HTTP_BASE = 'http://127.0.0.1:5000'

const MAX_TOKENS = 10
const META_TIMEOUT_MS = 1500

// Максимум дополнительных попыток после {ok: false} или таймаута
const META_RETRY_ATTEMPTS = 5
const META_RETRY_DELAY_MS = 1500

const PRICE_PATH = '/hub/price'
const PRICE_POLL_MS = 30_000

const http = axios.create({
    baseURL: HTTP_BASE,
    timeout: META_TIMEOUT_MS,
    headers: { Accept: 'application/json' }
})

function isTokenEvent(x: unknown): x is TokenEvent {
    if (!x || typeof x !== 'object') return false
    const v = x as Record<string, unknown>

    return (
        typeof v.address === 'string' &&
        typeof v.name === 'string' &&
        typeof v.ticker === 'string' &&
        typeof v.devhold === 'number' &&
        typeof v.protocol === 'string' &&
        (typeof v.metadata_url === 'string' || v.metadata_url === null)
    )
}

function normalizeMetadata(raw: any): Metadata | null {
    if (!raw || typeof raw !== 'object') return null

    const m: Metadata = {
        name: typeof raw.name === 'string' ? raw.name : null,
        ticker:
            typeof raw.symbol === 'string'
                ? raw.symbol
                : typeof raw.ticker === 'string'
                  ? raw.ticker
                  : null,
        image_url:
            typeof raw.image === 'string'
                ? raw.image
                : typeof raw.image_url === 'string'
                  ? raw.image_url
                  : null,
        telegram: typeof raw.telegram === 'string' ? raw.telegram : null,
        website:
            typeof raw.website === 'string'
                ? raw.website
                : typeof raw.external_url === 'string'
                  ? raw.external_url
                  : null,
        twitter: typeof raw.twitter === 'string' ? raw.twitter : null
    }

    m.has_socials = Boolean(m.twitter || m.telegram || m.website)
    return m
}

export function useSparkTokens() {
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectRef = useRef<number | null>(null)
    const lastPingRecvRef = useRef<number | null>(null)

    // key: tokenId → AbortController текущего HTTP-запроса
    const metaInflightRef = useRef<Map<string, AbortController>>(new Map())
    // key: tokenId → id таймера ожидания следующего retry
    const metaRetryTimersRef = useRef<Map<string, number>>(new Map())

    const totalProcessedRef = useRef<number>(0)

    const priceTimerRef = useRef<number | null>(null)
    const priceAbortRef = useRef<AbortController | null>(null)

    const [status, setStatus] = useState<WsStatus>('connecting')
    const [pingMs, setPingMs] = useState<number | null>(null)

    const [tokens, setTokens] = useState<TokenCardModel[]>([])
    const [totalProcessed, setTotalProcessed] = useState<number>(0)

    const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null)
    const [solPriceStatus, setSolPriceStatus] = useState<PriceStatus>('idle')

    // --- helpers ---

    const clearReconnect = () => {
        if (reconnectRef.current !== null) {
            window.clearTimeout(reconnectRef.current)
            reconnectRef.current = null
        }
    }

    /** Отменить всё in-flight для конкретного токена (запрос + таймер retry) */
    const cancelMeta = (tokenId: string) => {
        metaInflightRef.current.get(tokenId)?.abort()
        metaInflightRef.current.delete(tokenId)

        const timer = metaRetryTimersRef.current.get(tokenId)
        if (timer !== undefined) {
            window.clearTimeout(timer)
            metaRetryTimersRef.current.delete(tokenId)
        }
    }

    const stopAllMeta = () => {
        for (const id of [...metaInflightRef.current.keys()]) cancelMeta(id)
    }

    const stopPricePolling = () => {
        if (priceTimerRef.current !== null) {
            window.clearInterval(priceTimerRef.current)
            priceTimerRef.current = null
        }
        priceAbortRef.current?.abort()
        priceAbortRef.current = null
    }

    // --- sol price ---

    const fetchSolPrice = async (silent = false) => {
        priceAbortRef.current?.abort()
        const ctrl = new AbortController()
        priceAbortRef.current = ctrl

        if (!silent) setSolPriceStatus('loading')

        try {
            const res = await http.get(PRICE_PATH, { signal: ctrl.signal })
            const data = res.data as { ok?: boolean; price?: number }

            if (!data || data.ok !== true || typeof data.price !== 'number') {
                setSolPriceStatus('error')
                return
            }

            setSolPriceUsd(data.price)
            setSolPriceStatus('ready')
        } catch {
            setSolPriceStatus('error')
        } finally {
            if (priceAbortRef.current === ctrl) priceAbortRef.current = null
        }
    }

    const startPricePolling = () => {
        stopPricePolling()
        void fetchSolPrice(false)

        priceTimerRef.current = window.setInterval(() => {
            void fetchSolPrice(true)
        }, PRICE_POLL_MS)
    }

    // --- metadata ---

    /**
     * Выполняет ОДИН HTTP-запрос за метаданными токена.
     * Если сервер вернул {ok: false} и остались попытки — планирует
     * следующую попытку через setTimeout (fire-and-forget, не блокирует ничего).
     * Если запрос успешен или попытки исчерпаны — обновляет состояние.
     */
    const attemptMeta = (
        tokenId: string,
        metadataUrl: string,
        attemptsLeft: number
    ) => {
        // Чистим предыдущий таймер retry для этого токена (если был)
        const prevTimer = metaRetryTimersRef.current.get(tokenId)
        if (prevTimer !== undefined) {
            window.clearTimeout(prevTimer)
            metaRetryTimersRef.current.delete(tokenId)
        }

        // Отменяем предыдущий HTTP-запрос для этого токена
        metaInflightRef.current.get(tokenId)?.abort()

        const ctrl = new AbortController()
        metaInflightRef.current.set(tokenId, ctrl)

        http
            .get('/hub/meta', {
                signal: ctrl.signal,
                params: { url: metadataUrl }
            })
            .then(res => {
                if (ctrl.signal.aborted) return

                const data = res.data

                // Сервер ещё не готов → планируем retry не блокируя поток
                if (data && typeof data === 'object' && data.ok === false) {
                    if (attemptsLeft > 0) {
                        const timer = window.setTimeout(() => {
                            metaRetryTimersRef.current.delete(tokenId)
                            attemptMeta(tokenId, metadataUrl, attemptsLeft - 1)
                        }, META_RETRY_DELAY_MS)

                        metaRetryTimersRef.current.set(tokenId, timer)
                    } else {
                        // Все попытки исчерпаны
                        setTokens(prev =>
                            prev.map(x =>
                                x.id === tokenId
                                    ? { ...x, metadata: null, metaStatus: 'error' }
                                    : x
                            )
                        )
                        metaInflightRef.current.delete(tokenId)
                    }
                    return
                }

                // Успех
                const meta = normalizeMetadata(data)
                setTokens(prev =>
                    prev.map(x =>
                        x.id === tokenId
                            ? {
                                  ...x,
                                  metadata: meta,
                                  metaStatus: meta ? 'ready' : 'error'
                              }
                            : x
                    )
                )
                metaInflightRef.current.delete(tokenId)
            })
            .catch((err: any) => {
                const aborted =
                    err?.name === 'CanceledError' ||
                    err?.code === 'ERR_CANCELED' ||
                    ctrl.signal.aborted

                if (aborted) return

                // Таймаут или сетевая ошибка — пробуем retry если попытки остались
                const isRetryable =
                    err?.code === 'ECONNABORTED' ||
                    err?.code === 'ERR_NETWORK' ||
                    err?.message === 'Network Error'

                if (isRetryable && attemptsLeft > 0) {
                    const timer = window.setTimeout(() => {
                        metaRetryTimersRef.current.delete(tokenId)
                        attemptMeta(tokenId, metadataUrl, attemptsLeft - 1)
                    }, META_RETRY_DELAY_MS)

                    metaRetryTimersRef.current.set(tokenId, timer)
                    return
                }

                setTokens(prev =>
                    prev.map(x =>
                        x.id === tokenId
                            ? { ...x, metadata: null, metaStatus: 'error' }
                            : x
                    )
                )
                metaInflightRef.current.delete(tokenId)
            })
    }

    /** Публичная точка входа: запускает первую попытку + резервирует retry-слоты */
    const fetchMetadata = (tokenId: string, metadataUrl: string) => {
        // +1 — сама первая попытка, META_RETRY_ATTEMPTS — дополнительные
        attemptMeta(tokenId, metadataUrl, META_RETRY_ATTEMPTS)
    }

    // --- WebSocket ---

    const connect = (attempt = 0) => {
        clearReconnect()
        stopAllMeta()

        setStatus('connecting')

        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => setStatus('open')
        ws.onerror = () => setStatus('error')

        ws.onclose = () => {
            setStatus('closed')

            const base = Math.min(10_000, 500 * 2 ** attempt)
            const jitter = Math.floor(Math.random() * 250)

            reconnectRef.current = window.setTimeout(
                () => connect(attempt + 1),
                base + jitter
            )
        }

        ws.onmessage = evt => {
            if (typeof evt.data !== 'string') return

            let parsed: unknown
            try {
                parsed = JSON.parse(evt.data)
            } catch {
                return
            }

            if (typeof parsed !== 'object' || parsed === null) return
            const msg = parsed as WsMessage

            if (msg.type === 'ping') {
                lastPingRecvRef.current = performance.now()
                ws.send('pong')
                return
            }

            if (msg.type === 'pong_ack') {
                const t0 = lastPingRecvRef.current
                if (t0 !== null) setPingMs(Math.round(performance.now() - t0))
                return
            }

            if (!isTokenEvent(msg)) return

            totalProcessedRef.current += 1
            setTotalProcessed(totalProcessedRef.current)

            const id = msg.address

            setTokens(prevTokens => {
                const rest = prevTokens.filter(x => x.id !== id)
                const item: TokenCardModel = {
                    id,
                    token: msg,
                    metadata: null,
                    // Сразу 'loading' если есть URL — иначе React батчит
                    // этот вызов и setTokens('loading') из attemptMeta
                    // в один рендер, и 'idle' перезаписывает 'loading'
                    metaStatus:
                        msg.metadata_url && msg.metadata_url.length
                            ? 'loading'
                            : 'error'
                }
                return [item, ...rest].slice(0, MAX_TOKENS)
            })

            if (msg.metadata_url) {
                // Если этот токен уже был в обработке — отменяем старое
                cancelMeta(id)
                fetchMetadata(id, msg.metadata_url)
            }
        }
    }

    // --- lifecycle ---

    useEffect(() => {
        connect(0)
        startPricePolling()

        return () => {
            clearReconnect()
            stopAllMeta()
            stopPricePolling()
            wsRef.current?.close()
            wsRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        status,
        pingMs,
        tokens,
        totalProcessed,
        clearTokens: () => setTokens([]),
        solPriceUsd,
        solPriceStatus
    }
}