import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { LazyStore } from '@tauri-apps/plugin-store'
import http from '@/lib/http'

// --- types ---

export type LicenseStatus =
    | 'idle'              // начальное состояние, ещё не проверяли
    | 'checking'          // идёт проверка
    | 'active'            // лицензия валидна
    | 'not_activated'     // ключ есть, но не активирован на этом устройстве
    | 'no_license'        // ключ не введён
    | 'expired'           // истёк срок
    | 'revoked'           // лицензия отозвана
    | 'max_activations'   // достигнут лимит активаций
    | 'error'             // сетевая или иная ошибка

export interface AuthState {
    status: LicenseStatus
    licenseKey: string | null
    expiresAt: number | null    // unix ms
    deviceId: string | null
    errorMessage: string | null
}

interface AuthCtx extends AuthState {
    activate: (key: string) => Promise<void>
    recheck: () => Promise<void>
    logout: () => Promise<void>
}

// --- helpers ---

const VALIDATE_INTERVAL_MS = 60 * 60 * 1000  // 1 час

const store = new LazyStore('auth.json')

async function getDeviceId(): Promise<string> {
    return invoke<string>('get_device_id')
}

/** Маппинг detail-строк от API → LicenseStatus */
function mapApiError(detail: string): LicenseStatus {
    switch (detail) {
        case 'is_expired':               return 'expired'
        case 'is_revoked':               return 'revoked'
        case 'max_activations_reached':  return 'max_activations'
        case 'not_activated':            return 'not_activated'
        case 'not_found':                return 'no_license'
        default:                         return 'error'
    }
}

async function apiPost<T>(path: string, body: object): Promise<T> {
    try {
        const { data } = await http.post<T>(path, body)
        return data
    } catch (err: any) {
        const detail = err.response?.data?.detail ?? 'error'
        throw Object.assign(new Error(detail), { status: err.response?.status, detail })
    }
}

// --- context ---

const AuthContext = createContext<AuthCtx>({
    status: 'idle',
    licenseKey: null,
    expiresAt: null,
    deviceId: null,
    errorMessage: null,
    activate: async () => {},
    recheck: async () => {},
    logout: async () => {},
})

// --- provider ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        status: 'idle',
        licenseKey: null,
        expiresAt: null,
        deviceId: null,
        errorMessage: null,
    })

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const set = (patch: Partial<AuthState>) =>
        setState(prev => ({ ...prev, ...patch }))

    // --- validate (периодическая проверка) ---

    const validate = async (key: string, deviceId: string): Promise<void> => {
        set({ status: 'checking', errorMessage: null })
        try {
            const data = await apiPost<{ expires_at: number }>(
                '/hub/licenses/validate',
                { license_key: key, device_id: deviceId }
            )
            set({ status: 'active', expiresAt: data.expires_at })
            await store.set('expires_at', data.expires_at)
            await store.save()
        } catch (err: any) {
            const status = mapApiError(err.detail ?? '')
            set({ status, errorMessage: err.detail ?? 'Unknown error' })
            // При ошибке валидации чистим ключ из store если отозвана
            if (status === 'revoked') {
                await store.delete('license_key')
                await store.save()
                set({ licenseKey: null })
            }
        }
    }

    // --- activate ---

    const activate = async (key: string): Promise<void> => {
        const trimmed = key.trim()
        if (!trimmed) return

        set({ status: 'checking', errorMessage: null })

        let deviceId = state.deviceId
        if (!deviceId) {
            try {
                deviceId = await getDeviceId()
                set({ deviceId })
            } catch {
                set({ status: 'error', errorMessage: 'Failed to get device ID' })
                return
            }
        }

        try {
            const data = await apiPost<{ expires_at: number }>(
                '/hub/licenses/activate',
                { license_key: trimmed, device_id: deviceId }
            )
            await store.set('license_key', trimmed)
            await store.save()
            set({ status: 'active', licenseKey: trimmed, expiresAt: data.expires_at, errorMessage: null })
            await store.set('expires_at', data.expires_at)
            startInterval(trimmed, deviceId)
        } catch (err: any) {
            const status = mapApiError(err.detail ?? '')
            set({ status, errorMessage: err.detail ?? 'Unknown error' })
        }
    }

    // --- recheck (ручной ретрай) ---

    const recheck = async (): Promise<void> => {
        const { licenseKey, deviceId } = state
        if (!licenseKey || !deviceId) return
        await validate(licenseKey, deviceId)
    }

    // --- logout ---

    const logout = async (): Promise<void> => {
        stopInterval()
        await store.delete('license_key')
        await store.delete('expires_at')
        await store.save()
        setState({
            status: 'no_license',
            licenseKey: null,
            expiresAt: null,
            deviceId: state.deviceId,
            errorMessage: null,
        })
    }

    // --- periodic validation ---

    const startInterval = (key: string, deviceId: string) => {
        stopInterval()
        intervalRef.current = setInterval(() => {
            void validate(key, deviceId)
        }, VALIDATE_INTERVAL_MS)
    }

    const stopInterval = () => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }

    // --- boot: load saved key → validate ---

    useEffect(() => {
        async function boot() {
            set({ status: 'checking' })

            let deviceId: string
            try {
                deviceId = await getDeviceId()
                set({ deviceId })
            } catch {
                set({ status: 'error', errorMessage: 'Failed to get device ID' })
                return
            }

            const savedKey = await store.get<string>('license_key')
            if (!savedKey) {
                set({ status: 'no_license' })
                return
            }

            const savedExpiresAt = await store.get<number>('expires_at')
            set({ licenseKey: savedKey, expiresAt: savedExpiresAt ?? null })
            await validate(savedKey, deviceId)

            // Запускаем периодическую проверку только если активна
            setState(prev => {
                if (prev.status === 'active') startInterval(savedKey, deviceId)
                return prev
            })
        }

        void boot()
        return () => stopInterval()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <AuthContext.Provider value={{ ...state, activate, recheck, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

// --- hook ---

export function useAuth() {
    return useContext(AuthContext)
}
