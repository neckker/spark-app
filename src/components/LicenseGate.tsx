import { useState } from 'react'
import { KeyRound, RefreshCw, ShieldAlert, ShieldOff, Clock, MonitorX, AlertCircle, XCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAuth, type LicenseStatus } from '@/context/AuthContext'

// --- helpers ---

function fmtExpiry(tsMs: number | null): string {
    if (!tsMs) return ''
    try {
        return new Date(tsMs).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        })
    } catch { return '' }
}

// --- screen config ---

type ScreenCfg = {
    icon: React.ComponentType<{ className?: string }>
    iconCls: string
    title: string
    description: string
    showInput: boolean
    showRetry: boolean
}

function getScreenCfg(status: LicenseStatus, expiresAt: number | null): ScreenCfg {
    switch (status) {
        case 'expired':
            return {
                icon: Clock,
                iconCls: 'text-amber-400',
                title: 'License Expired',
                description: `Your license expired on ${fmtExpiry(expiresAt)}. Please renew to continue.`,
                showInput: true,
                showRetry: false,
            }
        case 'revoked':
            return {
                icon: ShieldOff,
                iconCls: 'text-red-400',
                title: 'License Revoked',
                description: 'Your license has been revoked. Please contact support.',
                showInput: true,
                showRetry: false,
            }
        case 'device_mismatch':
            return {
                icon: MonitorX,
                iconCls: 'text-red-400',
                title: 'Device Mismatch',
                description: 'This license is already activated on another device.',
                showInput: true,
                showRetry: false,
            }
        case 'error':
            return {
                icon: ShieldAlert,
                iconCls: 'text-zinc-400',
                title: 'Connection Error',
                description: 'Could not reach the license server. Check your internet connection.',
                showInput: false,
                showRetry: true,
            }
        case 'no_license':
        case 'not_activated':
        default:
            return {
                icon: KeyRound,
                iconCls: 'text-zinc-300',
                title: 'License Required',
                description: 'Enter your license key to activate the application.',
                showInput: true,
                showRetry: false,
            }
    }
}

// --- ErrorBlock ---

type ErrorVariant = 'warn' | 'error' | 'info'

const ERROR_MESSAGES: Partial<Record<LicenseStatus, {
    variant: ErrorVariant
    icon: React.ComponentType<{ className?: string }>
    title: string
    body: string
}>> = {
    no_license: {
        variant: 'error',
        icon: XCircle,
        title: 'Key not found',
        body: 'No license was found for this key. Double-check the key and try again.',
    },
    expired: {
        variant: 'warn',
        icon: Clock,
        title: 'License expired',
        body: 'This license key has passed its expiration date.',
    },
    revoked: {
        variant: 'error',
        icon: ShieldOff,
        title: 'License revoked',
        body: 'This key has been revoked and is no longer valid.',
    },
    device_mismatch: {
        variant: 'error',
        icon: MonitorX,
        title: 'Wrong device',
        body: 'This key is already activated on a different device.',
    },
    not_activated: {
        variant: 'info',
        icon: Info,
        title: 'Not activated',
        body: 'Key exists but has not been activated yet — submit to activate.',
    },
    error: {
        variant: 'warn',
        icon: AlertCircle,
        title: 'Server error',
        body: 'An unexpected error occurred. Please try again.',
    },
}

const VARIANT_STYLES: Record<ErrorVariant, { wrap: string; icon: string; title: string; body: string }> = {
    error: {
        wrap:  'bg-red-500/10 ring-1 ring-red-500/25',
        icon:  'text-red-400',
        title: 'text-red-300 font-medium',
        body:  'text-red-300/70',
    },
    warn: {
        wrap:  'bg-amber-500/10 ring-1 ring-amber-500/25',
        icon:  'text-amber-400',
        title: 'text-amber-300 font-medium',
        body:  'text-amber-300/70',
    },
    info: {
        wrap:  'bg-sky-500/10 ring-1 ring-sky-500/25',
        icon:  'text-sky-400',
        title: 'text-sky-300 font-medium',
        body:  'text-sky-300/70',
    },
}

function ErrorBlock({ status, apiMessage, inputError }: {
    status: LicenseStatus
    apiMessage: string | null
    inputError: string | null
}) {
    // Показываем только если была попытка активации (inputError) или API вернул ошибку
    if (inputError) {
        return (
            <div className='flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-red-500/10 ring-1 ring-red-500/25'>
                <AlertCircle className='h-4 w-4 text-red-400 shrink-0 mt-0.5' />
                <div>
                    <p className='text-xs text-red-300 font-medium'>Invalid input</p>
                    <p className='text-xs text-red-300/70 mt-0.5'>{inputError}</p>
                </div>
            </div>
        )
    }

    const cfg = ERROR_MESSAGES[status]
    if (!cfg) return null

    const s = VARIANT_STYLES[cfg.variant]
    const Icon = cfg.icon
    const body = status === 'error' && apiMessage ? apiMessage : cfg.body

    return (
        <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${s.wrap}`}>
            <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${s.icon}`} />
            <div>
                <p className={`text-xs ${s.title}`}>{cfg.title}</p>
                <p className={`text-xs mt-0.5 ${s.body}`}>{body}</p>
            </div>
        </div>
    )
}

// --- LicenseGate ---

export default function LicenseGate({ children }: { children: React.ReactNode }) {
    const { status, expiresAt, errorMessage, activate, recheck } = useAuth()

    // Отслеживаем была ли уже попытка активации в этой сессии
    const [attempted, setAttempted] = useState(false)
    const [inputKey, setInputKey]   = useState('')
    const [inputError, setInputError] = useState<string | null>(null)

    if (status === 'active') return <>{children}</>

    if (status === 'idle' || status === 'checking') {
        return (
            <div className='min-h-screen bg-main flex items-center justify-center'>
                <Spinner className='h-6 w-6 text-zinc-400' />
            </div>
        )
    }

    const cfg = getScreenCfg(status, expiresAt)
    const Icon = cfg.icon
    const isChecking = (status as string) === 'checking'

    const handleActivate = async () => {
        const trimmed = inputKey.trim()
        if (!trimmed) {
            setInputError('Please enter a license key')
            return
        }
        setInputError(null)
        setAttempted(true)
        await activate(trimmed)
    }

    // Для первого запуска (no_license без попытки) — не показываем ошибку
    const errorStatus: LicenseStatus | null = attempted ? status : null

    return (
        <div className='min-h-screen bg-main flex items-center justify-center p-6'>
            <div className='w-full max-w-md space-y-5'>

                {/* icon + title */}
                <div className='flex flex-col items-center gap-3 text-center'>
                    <div className='h-14 w-14 rounded-2xl flex items-center justify-center bg-white/5 ring-1 ring-white/10'>
                        <Icon className={`h-7 w-7 ${cfg.iconCls}`} />
                    </div>
                    <div>
                        <h1 className='text-lg font-semibold text-white'>{cfg.title}</h1>
                        <p className='mt-1 text-sm text-muted'>{cfg.description}</p>
                    </div>
                </div>

                {/* input form */}
                {cfg.showInput && (
                    <div className='space-y-2.5'>
                        <Input
                            value={inputKey}
                            onChange={e => {
                                setInputKey(e.target.value)
                                setInputError(null)
                            }}
                            placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                            className='bg-white/5 border-white/10 text-center font-mono text-sm tracking-wider w-full'
                            onKeyDown={e => { if (e.key === 'Enter') void handleActivate() }}
                            disabled={isChecking}
                        />

                        {/* error block — не показывается при первом запуске */}
                        {(inputError || errorStatus) && (
                            <ErrorBlock
                                status={errorStatus ?? status}
                                apiMessage={errorMessage}
                                inputError={inputError}
                            />
                        )}

                        <Button
                            className='w-full'
                            onClick={() => void handleActivate()}
                            disabled={isChecking || !inputKey.trim()}
                        >
                            {isChecking
                                ? <span className='inline-flex items-center gap-2'><Spinner className='h-4 w-4' />Checking…</span>
                                : 'Activate'
                            }
                        </Button>
                    </div>
                )}

                {/* retry */}
                {cfg.showRetry && (
                    <>
                        {errorStatus && (
                            <ErrorBlock
                                status={errorStatus}
                                apiMessage={errorMessage}
                                inputError={null}
                            />
                        )}
                        <Button
                            variant='outline'
                            className='w-full'
                            onClick={() => { setAttempted(true); void recheck() }}
                            disabled={isChecking}
                        >
                            {isChecking
                                ? <span className='inline-flex items-center gap-2'><Spinner className='h-4 w-4' />Checking…</span>
                                : <span className='inline-flex items-center gap-2'><RefreshCw className='h-4 w-4' />Retry</span>
                            }
                        </Button>
                    </>
                )}

            </div>
        </div>
    )
}
