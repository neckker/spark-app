import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link'

import { WEB_URL } from '@/config/env'
import {
    http,
    setToken,
    setAuthExpiredHandler,
    isPremiumActive,
    type User
} from '@/lib/http'

type Status = 'loading' | 'anonymous' | 'needs_premium' | 'authenticated'

interface AuthCtx {
    status: Status
    user: User | null
    isPremium: boolean
    connect: () => Promise<void>
    logout: () => Promise<void>
    revalidate: () => Promise<void>
}

const PENDING_STATE_KEY = 'spark.auth.pendingState'

const AuthContext = createContext<AuthCtx | null>(null)

async function loadToken(): Promise<string | null> {
    try {
        return await invoke<string | null>('secret_get')
    } catch {
        return null
    }
}

async function saveToken(token: string): Promise<void> {
    try {
        await invoke('secret_set', { value: token })
    } catch {
    }
}

async function deleteToken(): Promise<void> {
    try {
        await invoke('secret_delete')
    } catch {
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<Status>('loading')
    const [user, setUser] = useState<User | null>(null)

    const applyUser = useCallback((u: User) => {
        setUser(u)
        setStatus(isPremiumActive(u) ? 'authenticated' : 'needs_premium')
    }, [])

    const clearAuth = useCallback(async () => {
        setToken(null)
        await deleteToken()
        setUser(null)
    }, [])

    const refreshUser = useCallback(async (): Promise<void> => {
        try {
            const { user: u } = await http.get<{ user: User }>('/my/')
            applyUser(u)
        } catch {
            await clearAuth()
            setStatus('anonymous')
        }
    }, [applyUser, clearAuth])

    const adoptToken = useCallback(
        async (token: string): Promise<void> => {
            setToken(token)
            await saveToken(token)
            await refreshUser()
        },
        [refreshUser]
    )

    const handleDeepLink = useCallback(
        async (urls: string[]): Promise<void> => {
            for (const raw of urls) {
                let parsed: URL
                try {
                    parsed = new URL(raw)
                } catch {
                    continue
                }
                if (parsed.protocol !== 'spark:') continue

                const token = parsed.searchParams.get('token')
                const state = parsed.searchParams.get('state')
                if (!token) continue

                const expected = localStorage.getItem(PENDING_STATE_KEY)
                localStorage.removeItem(PENDING_STATE_KEY)
                if (!expected || state !== expected) continue

                setStatus('loading')
                await adoptToken(token)
                return
            }
        },
        [adoptToken]
    )

    const connect = useCallback(async (): Promise<void> => {
        const state = crypto.randomUUID()
        localStorage.setItem(PENDING_STATE_KEY, state)
        await openUrl(
            `${WEB_URL}/app/connect?state=${encodeURIComponent(state)}`
        )
    }, [])

    const logout = useCallback(async (): Promise<void> => {
        try {
            await http.post('/auth/logout')
        } catch {
        }
        await clearAuth()
        setStatus('anonymous')
    }, [clearAuth])

    // --- boot ---
    useEffect(() => {
        setAuthExpiredHandler(() => {
            setToken(null)
            void deleteToken()
            setUser(null)
            setStatus('anonymous')
        })

        let unlisten: (() => void) | null = null

        void (async () => {
            try {
                const initial = await getCurrent()
                if (initial && initial.length) {
                    await handleDeepLink(initial)
                }
            } catch {
            }

            unlisten = await onOpenUrl((urls) => {
                void handleDeepLink(urls)
            })

            const token = await loadToken()
            if (token) {
                setToken(token)
                await refreshUser()
            } else {
                setStatus((s) => (s === 'loading' ? 'anonymous' : s))
            }
        })()

        return () => {
            setAuthExpiredHandler(null)
            if (unlisten) unlisten()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (status !== 'authenticated' && status !== 'needs_premium') return

        const recheck = () => {
            if (document.visibilityState === 'visible') void refreshUser()
        }

        window.addEventListener('focus', recheck)
        document.addEventListener('visibilitychange', recheck)

        return () => {
            window.removeEventListener('focus', recheck)
            document.removeEventListener('visibilitychange', recheck)
        }
    }, [status, refreshUser])

    const value = useMemo<AuthCtx>(
        () => ({
            status,
            user,
            isPremium: status === 'authenticated',
            connect,
            logout,
            revalidate: refreshUser
        }),
        [status, user, connect, logout, refreshUser]
    )

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    )
}

export function useAuth(): AuthCtx {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>')
    }
    return ctx
}
