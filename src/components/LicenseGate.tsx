import { useState } from 'react'
import {
    KeyRound, RefreshCw, ShieldAlert, ShieldOff,
    Clock, AlertCircle, XCircle, Info, ExternalLink, Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FAQModal } from '@/components/FAQModal'
import http from '@/lib/http'
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

const REFERRAL_CODE_RE = /^[A-Za-z0-9_-]{4,16}$/

// --- screen config ---

type ScreenCfg = {
    icon: React.ComponentType<{ className?: string }>
    iconCls: string
    title: string
    description: React.ReactNode
    showInput: boolean
    showRetry: boolean
}

// Тип после guard-блока (idle и checking уже отброшены)
type ActiveLicenseStatus = Exclude<LicenseStatus, 'idle' | 'checking' | 'active'>

function getScreenCfg(status: ActiveLicenseStatus, expiresAt: number | null): ScreenCfg {
    const expiryLabel = fmtExpiry(expiresAt)

    switch (status) {
        case 'expired':
            return {
                icon: Clock,
                iconCls: 'text-amber-400',
                title: 'License Expired',
                description: expiryLabel
                    ? (
                        <>
                            Your license expired on{' '}
                            <span className='font-semibold text-amber-200'>{expiryLabel}</span>
                            . Please renew to continue.
                        </>
                    )
                    : 'Your license has expired. Please renew to continue.',
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
        case 'max_activations':
            return {
                icon: Users,
                iconCls: 'text-red-400',
                title: 'Activation Limit Reached',
                description: 'This license has reached its maximum number of device activations.',
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
    max_activations: {
        variant: 'error',
        icon: Users,
        title: 'Activation limit',
        body: 'This key has reached its maximum number of device activations.',
    },
    not_activated: {
        variant: 'info',
        icon: Info,
        title: 'Not activated',
        body: 'Key exists but has not been activated yet - submit to activate.',
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

    const s    = VARIANT_STYLES[cfg.variant]
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

// --- ReferralBlock ---

type ReferralPhase =
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'success' }
    | { phase: 'error'; message: string }

const REFERRAL_ERROR_LABELS: Record<string, string> = {
    not_found:       'This referral code does not exist.',
    own_code:        "You can't use your own referral code.",
    already_used:    'You have already used a referral code.',
    not_activated:   'Your license is not activated.',
    is_expired:      'Your license has expired.',
    is_revoked:      'Your license has been revoked.',
    trial_key:       'Referral codes are not available for trial licenses.'
}

function ReferralBlock({ deviceId }: { deviceId: string }) {
    const [code,  setCode]  = useState('')
    const [state, setState] = useState<ReferralPhase>({ phase: 'idle' })

    const handleApply = async () => {
        const trimmed = code.trim()
        if (!trimmed) return

        if (!REFERRAL_CODE_RE.test(trimmed)) {
            setState({ phase: 'error', message: '4–16 characters: letters, digits, _ or -' })
            return
        }

        setState({ phase: 'loading' })

        try {
            await http.post('/hub/referrer/apply', { device_id: deviceId, code: trimmed })
            setState({ phase: 'success' })
        } catch (err: any) {
            const detail = err.response?.data?.detail ?? ''
            const message = REFERRAL_ERROR_LABELS[detail] ?? 'Something went wrong. Please try again.'
            setState({ phase: 'error', message })
        }
    }

    if (state.phase === 'success') {
        return (
            <div className='flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-emerald-500/10 ring-1 ring-emerald-500/25'>
                <AlertCircle className='h-4 w-4 text-emerald-400 shrink-0' />
                <div>
                    <p className='text-xs text-emerald-300 font-medium'>Code applied</p>
                    <p className='text-xs text-emerald-300/70 mt-0.5'>Referral code was applied successfully.</p>
                </div>
            </div>
        )
    }

    return (
        <div className='space-y-2.5'>
            <div className='flex gap-2'>
                <Input
                    value={code}
                    onChange={e => { setCode(e.target.value); setState({ phase: 'idle' }) }}
                    placeholder='Referral code (optional)'
                    className='bg-white/5 border-white/10 font-mono text-sm flex-1'
                    onKeyDown={e => { if (e.key === 'Enter') void handleApply() }}
                    disabled={state.phase === 'loading'}
                    maxLength={16}
                />
                <Button
                    variant='outline'
                    onClick={handleApply}
                    disabled={state.phase === 'loading' || !code.trim()}
                    className='shrink-0'
                >
                    {state.phase === 'loading'
                        ? <Spinner className='h-4 w-4' />
                        : 'Apply'
                    }
                </Button>
            </div>

            {state.phase === 'error' && (
                <div className='flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-red-500/10 ring-1 ring-red-500/25'>
                    <AlertCircle className='h-4 w-4 text-red-400 shrink-0 mt-0.5' />
                    <div>
                        <p className='text-xs text-red-300 font-medium'>Invalid code</p>
                        <p className='text-xs text-red-300/70 mt-0.5'>{state.message}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- PurchaseBlock ---

function PurchaseBlock() {
    return (
        <div className='rounded-lg bg-white/3 ring-1 ring-white/8 p-3'>
            <div className='flex items-center justify-between gap-3'>
                <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-white'>Need a license key?</p>
                    <p className='text-xs text-muted mt-0.5'>Get instant access to Spark</p>
                </div>
                <a
                    href='https://t.me/solythbot'
                    target='_blank'
                    rel='noreferrer'
                    className='shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium bg-white/5 ring-1 ring-white/10 text-white hover:bg-white/8 hover:ring-white/15 transition-colors'
                >
                    <span>Purchase</span>
                    <ExternalLink className='h-3.5 w-3.5' />
                </a>
            </div>
        </div>
    )
}

// --- LicenseGate ---

export default function LicenseGate({ children }: { children: React.ReactNode }) {
    const { status, expiresAt, errorMessage, deviceId, activate, recheck } = useAuth()

    const [attempted,     setAttempted]     = useState(false)
    const [inputKey,      setInputKey]      = useState('')
    const [inputError,    setInputError]    = useState<string | null>(null)
    const [justActivated, setJustActivated] = useState(false)

    // ── active ────────────────────────────────────────────────────────────────
    if (status === 'active') {
        if (justActivated && deviceId) {
            return (
                <div className='min-h-screen bg-main flex items-center justify-center p-6'>
                    <div className='w-full max-w-md space-y-4'>
                        <div className='flex flex-col items-center gap-3 text-center'>
                            <div className='h-14 w-14 rounded-2xl flex items-center justify-center bg-emerald-500/10 ring-1 ring-emerald-500/20'>
                                <KeyRound className='h-7 w-7 text-emerald-400' />
                            </div>
                            <div>
                                <h1 className='text-lg font-semibold text-white'>License Activated!</h1>
                                <p className='mt-1 text-sm text-muted'>
                                    Got a referral code? Enter it below, or skip to continue.
                                </p>
                            </div>
                        </div>

                        <ReferralBlock deviceId={deviceId} />

                        <Button className='w-full' onClick={() => setJustActivated(false)}>
                            Continue
                        </Button>
                    </div>
                </div>
            )
        }
        return <>{children}</>
    }

    // ── loading ───────────────────────────────────────────────────────────────
    if (status === 'idle' || status === 'checking') {
        return (
            <div className='min-h-screen bg-main flex items-center justify-center'>
                <Spinner className='h-6 w-6 text-zinc-400' />
            </div>
        )
    }

    // После этой точки TypeScript знает: status — ActiveLicenseStatus
    const cfg  = getScreenCfg(status, expiresAt)
    const Icon = cfg.icon

    const handleActivate = async () => {
        const trimmed = inputKey.trim()
        if (!trimmed) {
            setInputError('Please enter a license key')
            return
        }
        setInputError(null)
        setAttempted(true)
        setJustActivated(true)   // выставляем заранее — если активация провалится,
                                 // status не станет 'active' и экран реферала не покажется
        await activate(trimmed)
    }

    const errorStatus: LicenseStatus | null  = attempted ? status : null
    const showPurchaseBlock = (['no_license', 'not_activated', 'expired', 'revoked', 'max_activations'] as LicenseStatus[]).includes(status)

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
                            onChange={e => { setInputKey(e.target.value); setInputError(null) }}
                            placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                            className='bg-white/5 border-white/10 text-center font-mono text-sm tracking-wider w-full'
                            onKeyDown={e => { if (e.key === 'Enter') void handleActivate() }}
                        />

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
                            disabled={!inputKey.trim()}
                        >
                            Activate
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
                        >
                            <span className='inline-flex items-center gap-2'>
                                <RefreshCw className='h-4 w-4' />
                                Retry
                            </span>
                        </Button>
                    </>
                )}

                {showPurchaseBlock && <PurchaseBlock />}

                <div className='flex justify-center mt-4'>
                    <FAQModal />
                </div>
            </div>
        </div>
    )
}
