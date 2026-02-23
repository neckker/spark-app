import React from 'react'
import toast from 'react-hot-toast'
import { openUrl } from '@tauri-apps/plugin-opener'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
    useSettings,
    type Terminal,
    type OpenMode,
    type FeesFilterMode,
} from '@/context/SettingsContext'
import { useAuth } from '@/context/AuthContext'
import { BACKEND_URL } from '@/config/env'
import {
    AlertCircle,
    Ban,
    Check,
    Clock4,
    Copy,
    KeyRound,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Tag,
    Users,
    X,
    Zap,
} from 'lucide-react'

import axiomIcon from '@/assets/terminals/axiom.svg'
import padreIcon from '@/assets/terminals/padre.svg'
import gmgnIcon from '@/assets/terminals/gmgn.svg'

// --- types ---

type Tab = 'main' | 'access' | 'referral' | 'labels' | 'blacklist'

type FieldKey = 'devMin' | 'devMax' | 'migrationPct' | 'feesFilterValue'
type Errors = Partial<Record<FieldKey, string>>

type RecentUsage = {
    device_id: string
    used_at: number
}

type ReferralStats = {
    code: string
    wallet: string
    uses: number
    created_at: number
    updated_at: number
    recent: RecentUsage[]
}

type EditMode = 'code' | 'wallet' | 'both' | null

// --- constants ---

const TABS: { id: Tab; label: string }[] = [
    { id: 'main',      label: 'Main'      },
    { id: 'access',    label: 'Access'    },
    { id: 'referral',  label: 'Referral'  },
    { id: 'labels',    label: 'Labels'    },
    { id: 'blacklist', label: 'Blacklist' },
]

const TERMINALS: { id: Terminal; label: string; icon: string; url: string }[] = [
    { id: 'axiom', label: 'Axiom', icon: axiomIcon, url: 'axiom.trade' },
    { id: 'padre', label: 'Padre', icon: padreIcon, url: 'padre.gg'   },
    { id: 'gmgn',  label: 'GMGN',  icon: gmgnIcon,  url: 'gmgn.ai'    },
]

const STATUS_CONFIG = {
    active:          { icon: ShieldCheck, color: 'text-emerald-400', label: 'Active'          },
    checking:        { icon: RefreshCw,   color: 'text-zinc-400',    label: 'Checking…'       },
    expired:         { icon: ShieldAlert, color: 'text-amber-400',   label: 'Expired'         },
    revoked:         { icon: ShieldAlert, color: 'text-rose-400',    label: 'Revoked'         },
    device_mismatch: { icon: ShieldAlert, color: 'text-rose-400',    label: 'Device mismatch' },
    not_activated:   { icon: ShieldAlert, color: 'text-amber-400',   label: 'Not activated'   },
    no_license:      { icon: ShieldAlert, color: 'text-zinc-400',    label: 'No license'      },
    error:           { icon: ShieldAlert, color: 'text-rose-400',    label: 'Error'           },
    idle:            { icon: ShieldAlert, color: 'text-zinc-400',    label: 'Unknown'         },
} as const

const CODE_RE = /^[A-Za-z0-9_-]{4,16}$/
const SOLANA_WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const COPY_RESET_MS = 2000

// --- helpers ---

const normalize = (v: string) => v.trim().replace(',', '.')

const parsePercent = (raw: string) => {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: false as const, error: 'Required' }
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return { ok: false as const, error: 'Invalid number' }
    return { ok: true as const, value: Math.max(0, Math.min(100, n)) }
}

const parseSol = (raw: string) => {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: false as const, error: 'Required' }
    const n = Number(cleaned)
    if (!Number.isFinite(n) || n < 0) return { ok: false as const, error: 'Invalid number' }
    return { ok: true as const, value: n }
}

const fmtDate = (tsMs: number) =>
    tsMs
        ? new Date(tsMs).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
        : '—'

// --- shared ui ---

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className='flex items-center gap-2 pb-0.5'>
            <span className='text-[11px] font-semibold uppercase tracking-widest text-muted/80'>
                {children}
            </span>
            <div className='flex-1 h-px bg-white/10' />
        </div>
    )
}

function SuffixInput({
    value,
    onChange,
    suffix,
    placeholder,
    error,
}: {
    value: string
    onChange: (v: string) => void
    suffix: string
    placeholder?: string
    error?: boolean
}) {
    return (
        <div className='relative'>
            <Input
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                className={cn('pr-14 bg-white/5 border-white/10', error && 'border-rose-500/60')}
            />
            <div className={cn(
                'absolute right-0 top-0 h-full px-3',
                'flex items-center text-white',
                'text-xs font-semibold tracking-wide',
                'border-l border-white/10 bg-white/5',
            )}>
                {suffix}
            </div>
        </div>
    )
}

function RowSwitch({
    label,
    description,
    checked,
    onCheckedChange,
    disabled,
}: {
    label: string
    description?: string
    checked: boolean
    onCheckedChange: (v: boolean) => void
    disabled?: boolean
}) {
    return (
        <div className='flex items-center justify-between gap-4'>
            <div className='min-w-0'>
                <div className='text-sm font-medium text-white'>{label}</div>
                {description && (
                    <div className='text-xs text-muted mt-0.5'>{description}</div>
                )}
            </div>
            <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                className='shrink-0'
            />
        </div>
    )
}

function FieldError({ message }: { message: string }) {
    return (
        <div className='flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-red-500/10 ring-1 ring-red-500/25'>
            <AlertCircle className='h-4 w-4 text-red-400 shrink-0 mt-0.5' />
            <p className='text-xs text-red-300/90 mt-0.5'>{message}</p>
        </div>
    )
}

function WalletWarning() {
    return (
        <div className='rounded-lg bg-amber-500/8 ring-1 ring-amber-500/20 px-3 py-2.5 flex items-start gap-2.5'>
            <AlertCircle className='h-4 w-4 text-amber-400 shrink-0 mt-0.5' />
            <p className='text-xs text-amber-300'>
                Make sure you have access to this wallet - we won't redo payments due to mistakes.
                You receive <span className='font-semibold text-white'>10%</span> of each referred subscription.
            </p>
        </div>
    )
}

// --- tab bar ---

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
    return (
        <div className='flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8'>
            {TABS.map(t => (
                <button
                    key={t.id}
                    type='button'
                    onClick={() => onChange(t.id)}
                    className={cn(
                        'flex-1 rounded-md px-2 py-1.5 text-xs cursor-pointer font-medium transition-colors',
                        active === t.id
                            ? 'bg-white/10 text-white'
                            : 'text-muted hover:text-zinc-300',
                    )}
                >
                    {t.label}
                </button>
            ))}
        </div>
    )
}

// --- terminal picker ---

function TerminalPicker({
    value,
    onChange,
    disabled,
}: {
    value: Terminal
    onChange: (t: Terminal) => void
    disabled?: boolean
}) {
    return (
        <div className='grid grid-cols-3 gap-2'>
            {TERMINALS.map(t => (
                <button
                    key={t.id}
                    type='button'
                    disabled={disabled}
                    onClick={() => onChange(t.id)}
                    className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg py-3 px-2',
                        'ring-1 transition-all duration-150 text-xs font-medium cursor-pointer',
                        value === t.id
                            ? 'bg-white/8 ring-white/25 text-white'
                            : 'bg-white/3 ring-white/8 text-muted hover:bg-white/6 hover:text-zinc-300',
                        disabled && 'opacity-40 cursor-not-allowed',
                    )}
                >
                    <img src={t.icon} alt={t.label} className='h-5 w-5' draggable={false} />
                    <span>{t.label}</span>
                    <span className='text-[10px] text-muted font-normal'>{t.url}</span>
                </button>
            ))}
        </div>
    )
}

// --- fees filter mode toggle ---

function FeesFilterModeToggle({
    value,
    onChange,
    disabled,
}: {
    value: FeesFilterMode
    onChange: (v: FeesFilterMode) => void
    disabled?: boolean
}) {
    return (
        <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
            {(['total', 'average'] as FeesFilterMode[]).map(mode => (
                <button
                    key={mode}
                    type='button'
                    disabled={disabled}
                    onClick={() => onChange(mode)}
                    className={cn(
                        'flex-1 rounded-[5px] px-3 py-1 cursor-pointer text-xs font-medium transition-colors',
                        value === mode
                            ? 'bg-white/10 text-white'
                            : 'text-muted hover:text-zinc-300',
                        disabled && 'opacity-40 cursor-not-allowed',
                    )}
                >
                    {mode === 'total' ? 'Total' : 'Average'}
                </button>
            ))}
        </div>
    )
}

// --- main tab ---

function MainTab({
    settings,
    store,
    busy,
    setBusy,
    onSaved,
}: {
    settings: ReturnType<typeof useSettings>['settings']
    store: ReturnType<typeof useSettings>['store']
    busy: boolean
    setBusy: (v: boolean) => void
    onSaved: () => void
}) {
    const { patch } = useSettings()

    const [devMin,            setDevMin]            = React.useState(String(settings.devMin))
    const [devMax,            setDevMax]            = React.useState(String(settings.devMax))
    const [migration,         setMigration]         = React.useState(String(settings.migrationPct))
    const [hideMayhem,        setHideMayhem]        = React.useState(settings.hideMayhem)
    const [feesFilterEnabled, setFeesFilterEnabled] = React.useState(settings.feesFilterEnabled)
    const [feesFilterMode,    setFeesFilterMode]    = React.useState<FeesFilterMode>(settings.feesFilterMode)
    const [feesFilterValue,   setFeesFilterValue]   = React.useState(String(settings.feesFilterValue))
    const [openInBrowser,     setOpenInBrowser]     = React.useState(settings.openInBrowser)
    const [openMode,          setOpenMode]          = React.useState<OpenMode>(settings.openMode)
    const [terminal,          setTerminal]          = React.useState<Terminal>(settings.terminal)
    const [uiScale,           setUIScale]           = React.useState(settings.uiScale)
    const [soundEnabled,      setSoundEnabled]      = React.useState(settings.soundEnabled)
    const [soundVolume,       setSoundVolume]       = React.useState(settings.soundVolume)
    const [errors,            setErrors]            = React.useState<Errors>({})

    React.useEffect(() => {
        setDevMin(String(settings.devMin))
        setDevMax(String(settings.devMax))
        setMigration(String(settings.migrationPct))
        setHideMayhem(settings.hideMayhem)
        setFeesFilterEnabled(settings.feesFilterEnabled)
        setFeesFilterMode(settings.feesFilterMode)
        setFeesFilterValue(String(settings.feesFilterValue))
        setOpenInBrowser(settings.openInBrowser)
        setOpenMode(settings.openMode)
        setTerminal(settings.terminal)
        setUIScale(settings.uiScale)
        setSoundEnabled(settings.soundEnabled)
        setSoundVolume(settings.soundVolume)
        setErrors({})
    }, [settings])

    const validate = () => {
        const next: Errors = {}
        const min = parsePercent(devMin)
        const max = parsePercent(devMax)
        const fees = parseSol(feesFilterValue)

        const migCleaned = normalize(migration)
        let migValue = 3
        if (!migCleaned) {
            next.migrationPct = 'Required'
        } else {
            const n = Number(migCleaned)
            if (!Number.isFinite(n)) {
                next.migrationPct = 'Invalid number'
            } else if (n < 3) {
                next.migrationPct = 'Minimum 3%'
            } else {
                migValue = Math.min(100, n)
            }
        }

        if (!min.ok) next.devMin = min.error
        else if (min.value < 0.1) next.devMin = 'Minimum 0.1%'
        if (!max.ok) next.devMax = max.error
        if (feesFilterEnabled && !fees.ok) next.feesFilterValue = fees.error

        if (min.ok && max.ok && !next.devMin && min.value > max.value) {
            next.devMin = 'Min > Max'
            next.devMax = 'Max < Min'
        }

        setErrors(next)

        return {
            ok: Object.keys(next).length === 0,
            values: {
                devMin:           min.ok ? Math.max(0.1, min.value) : 0.1,
                devMax:           max.ok ? max.value : 77,
                migrationPct:     migValue,
                hideMayhem,
                feesFilterEnabled,
                feesFilterMode,
                feesFilterValue:  fees.ok ? fees.value : 1,
                openInBrowser,
                openMode,
                terminal,
                uiScale,
                soundEnabled,
                soundVolume,
            },
        }
    }

    const save = async () => {
        if (!store || busy) return
        const res = validate()
        if (!res.ok) return
        setBusy(true)
        try {
            await patch(res.values)
            onSaved()
            toast.success('Settings saved')
        } catch {
            toast.error('Failed to save settings')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='space-y-5'>
            <div className='space-y-4 px-1'>
                <SectionLabel>Filters</SectionLabel>

                <div className='space-y-2'>
                    <Label>Dev Holdings %</Label>
                    <div className='grid grid-cols-2 gap-3'>
                        <SuffixInput value={devMin} onChange={setDevMin} suffix='MIN' placeholder='0.1' error={!!errors.devMin} />
                        <SuffixInput value={devMax} onChange={setDevMax} suffix='MAX' placeholder='77'  error={!!errors.devMax} />
                    </div>
                    {(errors.devMin || errors.devMax) && (
                        <p className='text-xs text-rose-300'>{errors.devMin || errors.devMax}</p>
                    )}
                </div>

                <div className='space-y-2'>
                    <Label>Migration rate %</Label>
                    <SuffixInput value={migration} onChange={setMigration} suffix='MIN' placeholder='15' error={!!errors.migrationPct} />
                    {errors.migrationPct
                        ? <p className='text-xs text-rose-300'>{errors.migrationPct}</p>
                        : <p className='text-xs text-muted'>Minimum allowed value is 3%</p>
                    }
                </div>

                <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5'>
                    <RowSwitch
                        label='Hide Mayhem tokens'
                        description='Skip pump.fun tokens launched in Mayhem mode'
                        checked={hideMayhem}
                        onCheckedChange={setHideMayhem}
                        disabled={busy}
                    />
                </div>

                <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                    <RowSwitch
                        label='Fees filter'
                        description="Filter by dev's fee history on previous tokens"
                        checked={feesFilterEnabled}
                        onCheckedChange={setFeesFilterEnabled}
                        disabled={busy}
                    />
                    {feesFilterEnabled && (
                        <>
                            <Separator className='opacity-40' />
                            <div className='space-y-3'>
                                <div className='space-y-1.5'>
                                    <Label className='text-xs text-muted'>Calculation mode</Label>
                                    <FeesFilterModeToggle value={feesFilterMode} onChange={setFeesFilterMode} disabled={busy} />
                                    <p className='text-xs text-muted'>
                                        {feesFilterMode === 'total'
                                            ? 'Sum of fees across all tracked tokens must exceed the threshold'
                                            : 'Average fee per token must exceed the threshold'
                                        }
                                    </p>
                                </div>
                                <div className='space-y-1.5'>
                                    <Label className='text-xs text-muted'>Threshold</Label>
                                    <SuffixInput value={feesFilterValue} onChange={setFeesFilterValue} suffix='SOL' placeholder='1' error={!!errors.feesFilterValue} />
                                    {errors.feesFilterValue && (
                                        <p className='text-xs text-rose-300'>{errors.feesFilterValue}</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className='space-y-4 px-1'>
                <SectionLabel>App Settings</SectionLabel>

                <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                    <RowSwitch
                        label='Auto-open token'
                        description='Automatically open new tokens in browser'
                        checked={openInBrowser}
                        onCheckedChange={setOpenInBrowser}
                        disabled={busy}
                    />
                    {openInBrowser && (
                        <>
                            <Separator className='opacity-40' />
                            <div className='space-y-1.5'>
                                <Label className='text-xs text-muted'>Open mode</Label>
                                <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
                                    {(['new-tab', 'current-tab'] as OpenMode[]).map(mode => (
                                        <button
                                            key={mode}
                                            type='button'
                                            disabled={busy}
                                            onClick={() => setOpenMode(mode)}
                                            className={cn(
                                                'flex-1 rounded-[5px] px-3 py-1 text-xs cursor-pointer font-medium transition-colors',
                                                openMode === mode ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                                                busy && 'opacity-40 cursor-not-allowed',
                                            )}
                                        >
                                            {mode === 'new-tab' ? 'New Tab' : 'Current Tab'}
                                        </button>
                                    ))}
                                </div>
                                {openMode === 'current-tab' && (
                                    <div className='flex items-center gap-2 rounded-md bg-amber-500/8 ring-1 ring-amber-500/15 px-2.5 py-1.5 mt-1'>
                                        <span className='text-amber-400 text-xs'>✨</span>
                                        <p className='text-xs text-amber-300 flex-1'>Requires Spark Extension</p>
                                        <button
                                            type='button'
                                            onClick={() => void openUrl('https://chromewebstore.google.com/detail/cmdanpdcddmkknljllainkehfdbdjfbc')}
                                            className='text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0 cursor-pointer'
                                        >
                                            Install Extension
                                        </button>
                                    </div>
                                )}
                            </div>
                            <Separator className='opacity-40' />
                            <div className='space-y-1.5'>
                                <Label className='text-xs text-muted'>Terminal</Label>
                                <TerminalPicker value={terminal} onChange={setTerminal} disabled={busy} />
                            </div>
                        </>
                    )}
                </div>

                <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                    <RowSwitch
                        label='Sound notifications'
                        description='Play a sound when a new token passes filters'
                        checked={soundEnabled}
                        onCheckedChange={setSoundEnabled}
                        disabled={busy}
                    />
                    {soundEnabled && (
                        <>
                            <Separator className='opacity-40' />
                            <div className='space-y-1.5'>
                                <div className='flex items-center justify-between'>
                                    <Label className='text-xs text-muted'>Volume</Label>
                                    <span className='text-xs font-semibold text-white tabular-nums'>{soundVolume}%</span>
                                </div>
                                <input
                                    type='range' min='0' max='100' step='5'
                                    value={soundVolume}
                                    onChange={e => setSoundVolume(Number(e.target.value))}
                                    disabled={busy}
                                    className='w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
                                />
                                <div className='relative flex text-[11px] text-muted tabular-nums h-4'>
                                    <span className='absolute left-0'>0%</span>
                                    <span className='absolute left-1/4 -translate-x-1/2'>25%</span>
                                    <span className='absolute left-1/2 -translate-x-1/2'>50%</span>
                                    <span className='absolute left-3/4 -translate-x-1/2'>75%</span>
                                    <span className='absolute right-0'>100%</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-3 space-y-3'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <div className='text-sm font-medium text-white'>UI Scale</div>
                            <div className='text-xs text-muted mt-0.5'>Adjust interface size</div>
                        </div>
                        <span className='text-sm font-semibold text-white tabular-nums'>{uiScale}%</span>
                    </div>
                    <input
                        type='range' min='75' max='150' step='5'
                        value={uiScale}
                        onChange={e => setUIScale(Number(e.target.value))}
                        disabled={busy}
                        className='w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
                    />
                    <div className='relative flex text-[11px] text-muted tabular-nums h-4'>
                        <span className='absolute left-0'>75%</span>
                        <span className='absolute left-1/3 -translate-x-1/2'>100%</span>
                        <span className='absolute left-2/3 -translate-x-1/2'>125%</span>
                        <span className='absolute right-0'>150%</span>
                    </div>
                </div>
            </div>

            <div className='flex justify-end pt-1'>
                <Button variant='default' onClick={save} disabled={busy}>
                    {busy
                        ? <span className='inline-flex items-center gap-2'><Spinner className='h-4 w-4' />Saving…</span>
                        : 'Save'
                    }
                </Button>
            </div>
        </div>
    )
}

// --- access tab ---

function AccessTab() {
    const { status, licenseKey, expiresAt, errorMessage } = useAuth()

    const timeLeft = React.useMemo(() => {
        if (!expiresAt) return null
        const msLeft = expiresAt - Date.now()
        if (msLeft <= 0) return 'Expired'
        const days    = Math.floor(msLeft / (1000 * 60 * 60 * 24))
        const hours   = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60))
        if (days >= 1)  return `${days}d ${hours}h`
        if (hours >= 1) return `${hours}h ${minutes}m`
        return `${minutes}m`
    }, [expiresAt])

    const progressPct = React.useMemo(() => {
        if (!expiresAt) return 0
        const msLeft = expiresAt - Date.now()
        if (msLeft <= 0) return 0
        const days = msLeft / (1000 * 60 * 60 * 24)
        const total =
            days > 300 ? 365 * 24 * 60 * 60 * 1000 :
            days > 25  ?  30 * 24 * 60 * 60 * 1000 :
            days > 5   ?   7 * 24 * 60 * 60 * 1000 :
            days > 1   ?   3 * 24 * 60 * 60 * 1000 :
                           1 * 24 * 60 * 60 * 1000
        return Math.max(0, Math.min(100, (msLeft / total) * 100))
    }, [expiresAt])

    const isActive = status === 'active'
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle
    const CfgIcon = cfg.icon

    const progressColor =
        progressPct > 30 ? 'bg-emerald-500' :
        progressPct > 10 ? 'bg-amber-400'   : 'bg-rose-500'

    return (
        <div className='space-y-4 p-1'>
            <div className='rounded-lg bg-white/3 ring-1 ring-white/8 p-3.5 space-y-3'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                        <CfgIcon className={cn('h-4 w-4', cfg.color, status === 'checking' && 'animate-spin')} />
                        <span className={cn('text-sm font-medium', cfg.color)}>{cfg.label}</span>
                    </div>
                    {isActive && timeLeft && (
                        <span className='inline-flex items-center gap-1 text-xs text-muted'>
                            <Clock4 className='h-3.5 w-3.5' />
                            <span className='tabular-nums text-white font-medium'>{timeLeft}</span>
                            <span className='text-muted'>left</span>
                        </span>
                    )}
                </div>

                {isActive && (
                    <div className='h-1 rounded-full bg-white/8 overflow-hidden'>
                        <div
                            className={cn('h-full rounded-full transition-all duration-500', progressColor)}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                )}

                {licenseKey && (
                    <div className='flex items-center gap-2'>
                        <KeyRound className='h-3.5 w-3.5 text-muted shrink-0' />
                        <span className='font-mono text-xs text-muted truncate'>{licenseKey}</span>
                    </div>
                )}

                {errorMessage && !isActive && (
                    <p className='text-xs text-rose-300'>{errorMessage}</p>
                )}
            </div>
            <a
                href='https://t.me/neckkero'
                target='_blank'
                rel='noreferrer'
                className={cn(
                    'flex items-center justify-center gap-2 w-full',
                    'rounded-md px-4 py-2 text-sm font-medium',
                    'bg-white/5 ring-1 ring-white/10',
                    'hover:bg-white/8 hover:ring-white/20',
                    'transition-colors text-white',
                )}
            >
                <Zap className='h-4 w-4 text-amber-400' />
                Renew access
            </a>
        </div>
    )
}

// --- referral tab ---

function ReferralTab() {
    const { deviceId } = useAuth()

    const [stats,        setStats]        = React.useState<ReferralStats | null>(null)
    const [loadingStats, setLoadingStats] = React.useState(true)

    const [codeInput,   setCodeInput]   = React.useState('')
    const [walletInput, setWalletInput] = React.useState('')
    const [codeError,   setCodeError]   = React.useState<string | null>(null)
    const [walletError, setWalletError] = React.useState<string | null>(null)

    const [saving,       setSaving]       = React.useState(false)
    const [editMode,     setEditMode]     = React.useState<EditMode>(null)
    const [copied,       setCopied]       = React.useState(false)
    const [copiedWallet, setCopiedWallet] = React.useState(false)

    React.useEffect(() => {
        if (!deviceId) return
        void loadStats()
    }, [deviceId])

    const loadStats = async () => {
        if (!deviceId) return
        setLoadingStats(true)
        try {
            const res  = await fetch(`${BACKEND_URL}/hub/referral/open-stats?device_id=${encodeURIComponent(deviceId)}`)
            const data = await res.json() as { ok: boolean } & Partial<ReferralStats>
            if (data.ok && data.code) {
                setStats({
                    code:       data.code,
                    wallet:     data.wallet     ?? '',
                    uses:       data.uses       ?? 0,
                    created_at: data.created_at ?? 0,
                    updated_at: data.updated_at ?? 0,
                    recent:     data.recent     ?? [],
                })
            } else {
                setStats(null)
            }
        } catch {
            setStats(null)
        } finally {
            setLoadingStats(false)
        }
    }

    const validateCode = (v: string): string | null => {
        if (!v.trim()) return 'Please enter a code'
        if (!CODE_RE.test(v.trim())) return '4–16 characters: letters, digits, _ or -'
        return null
    }

    const validateWallet = (v: string): string | null => {
        if (!v.trim()) return 'Please enter a wallet address'
        if (!SOLANA_WALLET_RE.test(v.trim())) return 'Invalid Solana wallet address'
        return null
    }

    const handleCreate = async () => {
        const trimmedCode   = codeInput.trim()
        const trimmedWallet = walletInput.trim()
        const codeErr   = validateCode(trimmedCode)
        const walletErr = validateWallet(trimmedWallet)
        setCodeError(codeErr)
        setWalletError(walletErr)
        if (codeErr || walletErr || !deviceId || saving) return

        setSaving(true)
        try {
            const res  = await fetch(`${BACKEND_URL}/hub/referral/new`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ device_id: deviceId, code: trimmedCode, wallet: trimmedWallet }),
            })
            const data = await res.json() as { ok?: boolean; detail?: string } & Partial<ReferralStats>

            if (!res.ok) {
                if (data.detail === 'code_taken') setCodeError('This code is already taken.')
                else if (data.detail === 'code_already_exists') setCodeError('You already have a referral code.')
                else setCodeError('Something went wrong.')
                return
            }

            setStats({
                code:       data.code       ?? trimmedCode,
                wallet:     data.wallet     ?? trimmedWallet,
                uses:       data.uses       ?? 0,
                created_at: data.created_at ?? 0,
                updated_at: data.updated_at ?? 0,
                recent:     [],
            })
            setCodeInput('')
            setWalletInput('')
            toast.success('Referral code created!')
        } catch {
            setCodeError('Network error. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const handleChange = async () => {
        if (!deviceId || saving || !editMode) return

        const trimmedCode   = editMode === 'code'   || editMode === 'both' ? codeInput.trim()   : null
        const trimmedWallet = editMode === 'wallet' || editMode === 'both' ? walletInput.trim() : null

        let codeErr:   string | null = null
        let walletErr: string | null = null

        if (trimmedCode   !== null) codeErr   = validateCode(trimmedCode)
        if (trimmedWallet !== null) walletErr = validateWallet(trimmedWallet)

        setCodeError(codeErr)
        setWalletError(walletErr)
        if (codeErr || walletErr) return

        setSaving(true)
        try {
            const body: Record<string, string> = { device_id: deviceId }
            if (trimmedCode)   body.new_code   = trimmedCode
            if (trimmedWallet) body.new_wallet = trimmedWallet

            const res  = await fetch(`${BACKEND_URL}/hub/referral/change`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body),
            })
            const data = await res.json() as { ok?: boolean; detail?: string } & Partial<ReferralStats>

            if (!res.ok) {
                if (data.detail === 'code_taken') setCodeError('This code is already taken.')
                else if (data.detail === 'same_code') setCodeError('This is already your current code.')
                else setCodeError('Something went wrong.')
                return
            }

            setStats(prev =>
                prev ? {
                    ...prev,
                    code:       data.code       ?? prev.code,
                    wallet:     data.wallet     ?? prev.wallet,
                    updated_at: data.updated_at ?? prev.updated_at,
                } : null
            )
            cancelEdit()
            toast.success('Updated!')
        } catch {
            setCodeError('Network error. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const copyCode = (code: string) => {
        void navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), COPY_RESET_MS)
    }

    const copyWallet = (wallet: string) => {
        void navigator.clipboard.writeText(wallet)
        setCopiedWallet(true)
        setTimeout(() => setCopiedWallet(false), COPY_RESET_MS)
    }

    const cancelEdit = () => {
        setEditMode(null)
        setCodeInput('')
        setWalletInput('')
        setCodeError(null)
        setWalletError(null)
    }

    // --- render ---

    if (loadingStats) {
        return (
            <div className='flex items-center justify-center py-10'>
                <Spinner className='h-5 w-5 text-zinc-500' />
            </div>
        )
    }

    // create form
    if (!stats) {
        return (
            <div className='space-y-4 p-1'>
                <SectionLabel>My Referral Code</SectionLabel>

                <WalletWarning />

                <div className='space-y-3'>
                    <div className='space-y-1.5'>
                        <p className='text-xs text-muted px-0.5'>Referral code</p>
                        <Input
                            value={codeInput}
                            onChange={e => { setCodeInput(e.target.value); setCodeError(null) }}
                            placeholder='Choose your code…'
                            className={cn('bg-white/5 border-white/10 font-mono text-sm', codeError && 'border-rose-500/60')}
                            maxLength={16}
                            autoFocus
                        />
                        {codeError
                            ? <FieldError message={codeError} />
                            : <p className='text-xs text-muted px-0.5'>4–16 characters: letters, digits, _ or -</p>
                        }
                    </div>

                    <div className='space-y-1.5'>
                        <p className='text-xs text-muted px-0.5'>Solana payout wallet</p>
                        <Input
                            value={walletInput}
                            onChange={e => { setWalletInput(e.target.value); setWalletError(null) }}
                            placeholder='Your Solana wallet address…'
                            className={cn('bg-white/5 border-white/10 font-mono text-sm', walletError && 'border-rose-500/60')}
                            onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
                        />
                        {walletError && <FieldError message={walletError} />}
                    </div>

                    <Button
                        className='w-full'
                        onClick={handleCreate}
                        disabled={saving || !codeInput.trim() || !walletInput.trim()}
                    >
                        {saving ? <Spinner className='h-4 w-4' /> : 'Create Referral Code'}
                    </Button>
                </div>
            </div>
        )
    }

    // code card
    return (
        <div className='space-y-4 p-1'>
            <SectionLabel>My Referral Code</SectionLabel>

            {/* info card */}
            <div className='rounded-lg bg-white/3 ring-1 ring-white/8 p-3.5 space-y-3'>

                {/* code row */}
                <div className='flex items-center gap-2'>
                    <span className='font-mono text-base font-bold text-white tracking-widest flex-1 select-all'>
                        {stats.code}
                    </span>
                    <button
                        type='button'
                        title={copied ? 'Copied!' : 'Copy code'}
                        onClick={() => copyCode(stats.code)}
                        className={cn(
                            'p-1.5 rounded-md transition-colors cursor-pointer',
                            copied
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-muted hover:text-white hover:bg-white/8',
                        )}
                    >
                        {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
                    </button>
                    <button
                        type='button'
                        onClick={() => { setEditMode('code'); setCodeInput(stats.code) }}
                        className='text-xs font-medium cursor-pointer text-muted hover:text-white transition-colors px-2 py-1 rounded-md bg-white/5 ring-1 ring-white/8 hover:bg-white/8'
                    >
                        Change
                    </button>
                </div>

                <Separator className='opacity-20' />

                {/* wallet row */}
                <div className='flex items-center justify-between gap-2'>
                    <span className='font-mono text-xs text-white truncate'>
                        {stats.wallet.slice(0, 6)}…{stats.wallet.slice(-6)}
                    </span>
                    <div className='flex items-center gap-1.5 shrink-0'>
                        <button
                            type='button'
                            title={copiedWallet ? 'Copied!' : 'Copy wallet'}
                            onClick={() => copyWallet(stats.wallet)}
                            className={cn(
                                'p-1.5 rounded-md transition-colors cursor-pointer',
                                copiedWallet
                                    ? 'text-emerald-400 bg-emerald-500/10'
                                    : 'text-muted hover:text-white hover:bg-white/8',
                            )}
                        >
                            {copiedWallet
                                ? <Check className='h-3.5 w-3.5' />
                                : <Copy className='h-3.5 w-3.5' />
                            }
                        </button>
                        <button
                            type='button'
                            onClick={() => { setEditMode('wallet'); setWalletInput(stats.wallet) }}
                            className='text-xs font-medium cursor-pointer text-muted hover:text-white transition-colors px-2 py-1 rounded-md bg-white/5 ring-1 ring-white/8 hover:bg-white/8'
                        >
                            Change
                        </button>
                    </div>
                </div>

                <Separator className='opacity-20' />

                {/* stats row */}
                <div className='flex items-center justify-between text-xs text-muted'>
                    <div className='flex items-center gap-1.5'>
                        <Users className='h-3.5 w-3.5 shrink-0' />
                        <span className='font-medium uppercase'>
                            <span className='text-white tabular-nums'>{stats.uses}</span>
                            {' '}referral{stats.uses !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <span>{fmtDate(stats.created_at)}</span>
                </div>
            </div>

            {/* edit form */}
            {editMode && (
                <div className='space-y-2.5'>
                    {(editMode === 'wallet' || editMode === 'both') && (
                        <WalletWarning />
                    )}

                    {(editMode === 'code' || editMode === 'both') && (
                        <div className='space-y-1.5'>
                            <p className='text-xs text-muted px-0.5'>New referral code</p>
                            <Input
                                value={codeInput}
                                onChange={e => { setCodeInput(e.target.value); setCodeError(null) }}
                                placeholder='New code…'
                                className={cn('bg-white/5 border-white/10 font-mono text-sm', codeError && 'border-rose-500/60')}
                                disabled={saving}
                                maxLength={16}
                                autoFocus
                            />
                            {codeError
                                ? <FieldError message={codeError} />
                                : <p className='text-xs text-muted px-0.5'>4–16 characters: letters, digits, _ or -</p>
                            }
                        </div>
                    )}

                    {(editMode === 'wallet' || editMode === 'both') && (
                        <div className='space-y-1.5'>
                            <p className='text-xs text-muted px-0.5'>New payout wallet</p>
                            <Input
                                value={walletInput}
                                onChange={e => { setWalletInput(e.target.value); setWalletError(null) }}
                                placeholder='New Solana wallet address…'
                                className={cn('bg-white/5 border-white/10 font-mono text-sm', walletError && 'border-rose-500/60')}
                                disabled={saving}
                                autoFocus={editMode === 'wallet'}
                            />
                            {walletError && <FieldError message={walletError} />}
                        </div>
                    )}

                    <div className='flex gap-2'>
                        <Button onClick={handleChange} disabled={saving} className='flex-1'>
                            {saving ? <Spinner className='h-4 w-4' /> : 'Save'}
                        </Button>
                        <Button variant='ghost' onClick={cancelEdit} disabled={saving} className='text-muted hover:text-white'>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* recent referrals */}
            {stats.recent.length > 0 && (
                <div className='space-y-2'>
                    <SectionLabel>Recent Referrals</SectionLabel>
                    <div className='space-y-1.5'>
                        {stats.recent.map((r, i) => (
                            <div
                                key={i}
                                className='flex items-center justify-between rounded-lg px-3 py-2 bg-white/3 ring-1 ring-white/8'
                            >
                                <span className='font-mono text-xs text-muted'>{r.device_id}</span>
                                <span className='text-xs text-muted'>{fmtDate(r.used_at)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// --- labels tab ---

function LabelsTab() {
    const { walletLabels, removeWalletLabel } = useSettings()
    const entries = Object.entries(walletLabels)

    if (entries.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                <Tag className='h-8 w-8 opacity-30' />
                <span className='text-sm'>No labels yet</span>
                <span className='text-xs opacity-60'>Label a dev wallet from any token card</span>
            </div>
        )
    }

    return (
        <div className='space-y-1.5 p-1'>
            {entries.map(([addr, label]) => (
                <div key={addr} className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'>
                    <span className='text-sky-300 font-medium text-xs uppercase shrink-0'>{label}</span>
                    <span className='text-muted font-mono text-xs truncate flex-1'>{addr}</span>
                    <button
                        type='button'
                        title='Remove label'
                        onClick={() => { void removeWalletLabel(addr); toast.success('Label removed') }}
                        className='shrink-0 text-muted hover:text-rose-400 transition-colors'
                    >
                        <X className='h-3.5 w-3.5' />
                    </button>
                </div>
            ))}
        </div>
    )
}

// --- blacklist tab ---

function BlacklistTab() {
    const { blacklist, walletLabels, removeFromBlacklist } = useSettings()
    const entries = [...blacklist]

    if (entries.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                <Ban className='h-8 w-8 opacity-30' />
                <span className='text-sm'>Blacklist is empty</span>
                <span className='text-xs opacity-60'>Ban a dev wallet from any token card</span>
            </div>
        )
    }

    return (
        <div className='space-y-1.5 p-1'>
            {entries.map(addr => {
                const label = walletLabels[addr]
                return (
                    <div key={addr} className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'>
                        {label && (
                            <span className='text-sky-300 font-medium text-xs uppercase shrink-0'>{label}</span>
                        )}
                        <span className='text-muted font-mono text-xs truncate flex-1'>{addr}</span>
                        <button
                            type='button'
                            title='Remove from blacklist'
                            onClick={() => { void removeFromBlacklist(addr); toast.success('Removed from blacklist') }}
                            className='shrink-0 text-muted hover:text-rose-400 transition-colors'
                        >
                            <X className='h-3.5 w-3.5' />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

// --- settings dialog ---

export default function SettingsDialog({ children }: { children: React.ReactNode }) {
    const { settings, store, ready } = useSettings()

    const [open, setOpen] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [tab,  setTab]  = React.useState<Tab>('main')

    const contentRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
        if (open) setTab('main')
    }, [open])

    if (!ready) return null

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>

            <DialogContent
                tabIndex={-1}
                ref={contentRef}
                className='sm:max-w-115 flex flex-col max-h-[85vh]'
                onOpenAutoFocus={e => {
                    e.preventDefault()
                    requestAnimationFrame(() => contentRef.current?.focus())
                }}
            >
                <DialogHeader className='shrink-0'>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>App settings</DialogDescription>
                </DialogHeader>

                <div className='shrink-0'>
                    <TabBar active={tab} onChange={setTab} />
                </div>

                <div className='flex-1 overflow-y-auto min-h-0'>
                    {tab === 'main' && (
                        <MainTab
                            settings={settings}
                            store={store}
                            busy={busy}
                            setBusy={setBusy}
                            onSaved={() => setOpen(false)}
                        />
                    )}
                    {tab === 'access'    && <AccessTab />}
                    {tab === 'referral'  && <ReferralTab />}
                    {tab === 'labels'    && <LabelsTab />}
                    {tab === 'blacklist' && <BlacklistTab />}
                </div>
            </DialogContent>
        </Dialog>
    )
}
