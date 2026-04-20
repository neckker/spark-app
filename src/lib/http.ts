import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios'
import { BACKEND_URL } from '@/config/env'

// ── config ──
//
// First-request cold path (fresh DNS, TLS handshake, potentially warming
// backend) can easily take a few seconds. We give each attempt a generous
// timeout and auto-retry *only* transient network failures — HTTP 4xx / 5xx
// with a real response are backend verdicts and must be surfaced.

const TIMEOUT_MS = 15_000
const MAX_RETRIES = 2                         // total attempts = 1 + MAX_RETRIES
const BACKOFF_MS = [500, 1500] as const       // indexed by retry count (0, 1)

interface RetryableConfig extends AxiosRequestConfig {
    _retryCount?: number
}

const http: AxiosInstance = axios.create({
    baseURL: BACKEND_URL,
    withCredentials: false,
    timeout: TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
})

// Retry transient network / timeout failures only.
// Signatures we treat as transient:
//   - no response arrived at all (err.response == null)
//   - axios reports ECONNABORTED (our own timeout fired)
// Everything with a response (4xx/5xx) is returned as-is so callers can react
// to `expired` / `revoked` / backend validation errors without being masked.

http.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
        const config = error.config as RetryableConfig | undefined
        if (!config) return Promise.reject(error)

        const isTimeout = error.code === 'ECONNABORTED'
        const isNetworkError = !error.response
        if (!isNetworkError && !isTimeout) return Promise.reject(error)

        const attempt = config._retryCount ?? 0
        if (attempt >= MAX_RETRIES) return Promise.reject(error)

        const delay = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
        config._retryCount = attempt + 1

        await new Promise(resolve => setTimeout(resolve, delay))
        return http.request(config)
    },
)

export default http
