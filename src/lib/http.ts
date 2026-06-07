import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { API_URL } from '@/config/env'

let token: string | null = null

export function setToken(next: string | null): void {
    token = next
}

export function getToken(): string | null {
    return token
}

type AuthExpiredHandler = () => void
let onAuthExpired: AuthExpiredHandler | null = null

export function setAuthExpiredHandler(fn: AuthExpiredHandler | null): void {
    onAuthExpired = fn
}

export class HttpError extends Error {
    status: number
    detail: unknown

    constructor(status: number, detail: unknown) {
        super(`http_${status}`)
        this.name = 'HttpError'
        this.status = status
        this.detail = detail
    }
}

interface RequestOptions {
    method?: string
    body?: unknown
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await tauriFetch(`${API_URL}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    })

    if (res.status === 401 || res.status === 403) {
        onAuthExpired?.()
    }

    const text = await res.text()
    let data: unknown = null
    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            data = null
        }
    }

    if (!res.ok) {
        const detail =
            data && typeof data === 'object' && 'detail' in data
                ? (data as { detail: unknown }).detail
                : data
        throw new HttpError(res.status, detail)
    }

    return data as T
}

export const http = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: 'POST', body }),
    put: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: 'PUT', body }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
}

// --- user (mirror of the spark-api /my/ payload) ---

export interface User {
    id: string
    email: string | null
    discord: {
        username: string
        avatar: string | null
        verified: boolean
        mfa_enabled: boolean
        created_at: number
    }
    profile: {
        handle: string | null
        wallet: string | null
    }
    referral: {
        reward_pct: number | null
        referred_by: string | null
    }
    commerce: {
        discount: number
        has_used_trial: boolean
        first_purchase_at: number | null
    }
    status: {
        is_blocked: boolean
        blocked_at: number | null
        reason: string | null
    }
    access: {
        is_owner: boolean
        is_admin: boolean
        is_partner: boolean
        permissions: number
    }
    premium: {
        is_active: boolean
        started_at: number | null
        expires_at: number | null
    }
    created_at: number
    last_login_at: number | null
}

export function isPremiumActive(u: User | null | undefined): boolean {
    if (!u?.premium?.is_active) return false
    return (u.premium.expires_at ?? 0) > Date.now()
}
