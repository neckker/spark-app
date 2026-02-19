import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useSettings, type Terminal, type OpenMode, type FeesFilterMode } from '@/context/SettingsContext'
import { Ban, Tag, X, KeyRound, RefreshCw, Zap, ShieldCheck, ShieldAlert, Clock4 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { openUrl } from '@tauri-apps/plugin-opener'

import axiomIcon from '@/assets/terminals/axiom.svg'
import padreIcon from '@/assets/terminals/padre.svg'
import gmgnIcon  from '@/assets/terminals/gmgn.svg'

// ─── types ────────────────────────────────────────────────────────────────────

type Tab = 'main' | 'access' | 'labels' | 'blacklist'

type FieldKey = 'devMin' | 'devMax' | 'migrationPct' | 'feesFilterValue'
type Errors = Partial<Record<FieldKey, string>>

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── SectionLabel ─────────────────────────────────────────────────────────────

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

// ─── SuffixInput ──────────────────────────────────────────────────────────────

function SuffixInput({
    value, onChange, suffix, placeholder, error
}: {
    value: string; onChange: (v: string) => void
    suffix: string; placeholder?: string; error?: boolean
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
                'border-l border-white/10 bg-white/5'
            )}>
                {suffix}
            </div>
        </div>
    )
}

// ─── RowSwitch ────────────────────────────────────────────────────────────────

function RowSwitch({
    label, description, checked, onCheckedChange, disabled
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
                {description && <div className='text-xs text-muted mt-0.5'>{description}</div>}
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className='shrink-0' />
        </div>
    )
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
    const tabs: { id: Tab; label: string }[] = [
        { id: 'main',      label: 'Main' },
        { id: 'access',    label: 'Access' },
        { id: 'labels',    label: 'Labels' },
        { id: 'blacklist', label: 'Blacklist' },
    ]
    return (
        <div className='flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8'>
            {tabs.map(t => (
                <button
                    key={t.id} type='button'
                    onClick={() => onChange(t.id)}
                    className={cn(
                        'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        active === t.id ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300'
                    )}
                >
                    {t.label}
                </button>
            ))}
        </div>
    )
}

// ─── TerminalPicker ───────────────────────────────────────────────────────────

const TERMINALS: { id: Terminal; label: string; icon: string; url: string }[] = [
    { id: 'axiom', label: 'Axiom', icon: axiomIcon, url: 'axiom.trade' },
    { id: 'padre', label: 'Padre', icon: padreIcon, url: 'padre.gg'   },
    { id: 'gmgn',  label: 'GMGN',  icon: gmgnIcon,  url: 'gmgn.ai'    },
]

function TerminalPicker({ value, onChange, disabled }: {
    value: Terminal
    onChange: (t: Terminal) => void
    disabled?: boolean
}) {
    return (
        <div className='grid grid-cols-3 gap-2'>
            {TERMINALS.map(t => {
                const active = value === t.id
                return (
                    <button
                        key={t.id} type='button' disabled={disabled}
                        onClick={() => onChange(t.id)}
                        className={cn(
                            'flex flex-col items-center gap-1.5 rounded-lg py-3 px-2',
                            'ring-1 transition-all duration-150 text-xs font-medium',
                            active
                                ? 'bg-white/8 ring-white/25 text-white'
                                : 'bg-white/3 ring-white/8 text-muted hover:bg-white/6 hover:text-zinc-300',
                            disabled && 'opacity-40 cursor-not-allowed'
                        )}
                    >
                        <img src={t.icon} alt={t.label} className='h-5 w-5' draggable={false} />
                        <span>{t.label}</span>
                        <span className='text-[10px] text-muted font-normal'>{t.url}</span>
                    </button>
                )
            })}
        </div>
    )
}

// ─── FeesFilterModeToggle ─────────────────────────────────────────────────────

function FeesFilterModeToggle({ value, onChange, disabled }: {
    value: FeesFilterMode
    onChange: (v: FeesFilterMode) => void
    disabled?: boolean
}) {
    return (
        <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
            {(['total', 'average'] as FeesFilterMode[]).map(mode => (
                <button
                    key={mode} type='button' disabled={disabled}
                    onClick={() => onChange(mode)}
                    className={cn(
                        'flex-1 rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
                        value === mode ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                        disabled && 'opacity-40 cursor-not-allowed'
                    )}
                >
                    {mode === 'total' ? 'Total' : 'Average'}
                </button>
            ))}
        </div>
    )
}

// ─── MainTab ──────────────────────────────────────────────────────────────────

function MainTab({
    settings, store, busy, setBusy, onSaved,
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
        setErrors({})
    }, [settings])

    const validate = () => {
        const next: Errors = {}
        const min = parsePercent(devMin)
        const max = parsePercent(devMax)

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

        const fees = parseSol(feesFilterValue)
        if (!min.ok) next.devMin = min.error
        if (!max.ok) next.devMax = max.error
        if (feesFilterEnabled && !fees.ok) next.feesFilterValue = fees.error
        if (min.ok && max.ok && min.value > max.value) {
            next.devMin = 'Min > Max'
            next.devMax = 'Max < Min'
        }
        setErrors(next)
        return {
            ok: Object.keys(next).length === 0,
            values: {
                devMin:            min.ok ? min.value : 0,
                devMax:            max.ok ? max.value : 100,
                migrationPct:      migValue,
                hideMayhem,
                feesFilterEnabled,
                feesFilterMode,
                feesFilterValue:   fees.ok ? fees.value : 1,
                openInBrowser,
                openMode,
                terminal,
                uiScale,
            }
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

            {/* ══ FILTERS ══════════════════════════════════════════════════════ */}
            <div className='space-y-4 px-1'>
                <SectionLabel>Filters</SectionLabel>

                {/* Dev Holdings */}
                <div className='space-y-2'>
                    <Label>Dev Holdings %</Label>
                    <div className='grid grid-cols-2 gap-3'>
                        <SuffixInput value={devMin} onChange={setDevMin} suffix='MIN' placeholder='0'   error={!!errors.devMin} />
                        <SuffixInput value={devMax} onChange={setDevMax} suffix='MAX' placeholder='100' error={!!errors.devMax} />
                    </div>
                    {(errors.devMin || errors.devMax) && (
                        <p className='text-xs text-rose-300'>{errors.devMin || errors.devMax}</p>
                    )}
                </div>

                {/* Migration */}
                <div className='space-y-2'>
                    <Label>Migration rate %</Label>
                    <SuffixInput value={migration} onChange={setMigration} suffix='MIN' placeholder='3' error={!!errors.migrationPct} />
                    {errors.migrationPct
                        ? <p className='text-xs text-rose-300'>{errors.migrationPct}</p>
                        : <p className='text-xs text-muted'>Minimum allowed value is 3%</p>
                    }
                </div>

                {/* Mayhem */}
                <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5'>
                    <RowSwitch
                        label='Hide Mayhem tokens'
                        description='Skip pump.fun tokens launched in Mayhem mode'
                        checked={hideMayhem}
                        onCheckedChange={setHideMayhem}
                        disabled={busy}
                    />
                </div>

                {/* Fees filter */}
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
                                    <FeesFilterModeToggle
                                        value={feesFilterMode}
                                        onChange={setFeesFilterMode}
                                        disabled={busy}
                                    />
                                    <p className='text-xs text-muted'>
                                        {feesFilterMode === 'total'
                                            ? 'Sum of fees across all tracked tokens must exceed the threshold'
                                            : 'Average fee per token must exceed the threshold'
                                        }
                                    </p>
                                </div>

                                <div className='space-y-1.5'>
                                    <Label className='text-xs text-muted'>Threshold</Label>
                                    <SuffixInput
                                        value={feesFilterValue}
                                        onChange={setFeesFilterValue}
                                        suffix='SOL'
                                        placeholder='1'
                                        error={!!errors.feesFilterValue}
                                    />
                                    {errors.feesFilterValue && (
                                        <p className='text-xs text-rose-300'>{errors.feesFilterValue}</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ══ APP SETTINGS ═════════════════════════════════════════════════ */}
            <div className='space-y-4 px-1'>
                <SectionLabel>App Settings</SectionLabel>

                {/* Auto-open + terminal picker */}
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

                            {/* Open mode — сверху */}
                            <div className='space-y-1.5'>
                                <Label className='text-xs text-muted'>Open mode</Label>
                                <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
                                    {(['new-tab', 'current-tab'] as OpenMode[]).map(mode => (
                                        <button
                                            key={mode} type='button' disabled={busy}
                                            onClick={() => setOpenMode(mode)}
                                            className={cn(
                                                'flex-1 rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
                                                openMode === mode ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                                                busy && 'opacity-40 cursor-not-allowed'
                                            )}
                                        >
                                            {mode === 'new-tab' ? 'New tab' : 'Current tab'}
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

                {/* UI Scale */}
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

            {/* ── Save ── */}
            <div className='flex justify-end pt-1'>
                <Button variant='default' onClick={save} disabled={busy}>
                    {busy ? (
                        <span className='inline-flex items-center gap-2'>
                            <Spinner className='h-4 w-4' />
                            Saving…
                        </span>
                    ) : 'Save'}
                </Button>
            </div>
        </div>
    )
}

// ─── AccessTab ────────────────────────────────────────────────────────────────

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

    const statusConfig = {
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

    const cfg     = statusConfig[status] ?? statusConfig.idle
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
                target='_blank' rel='noreferrer'
                className={cn(
                    'flex items-center justify-center gap-2 w-full',
                    'rounded-md px-4 py-2 text-sm font-medium',
                    'bg-white/5 ring-1 ring-white/10',
                    'hover:bg-white/8 hover:ring-white/20',
                    'transition-colors text-white'
                )}
            >
                <Zap className='h-4 w-4 text-amber-400' />
                Renew access
            </a>
        </div>
    )
}

// ─── LabelsTab ────────────────────────────────────────────────────────────────

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
                        type='button' title='Remove label'
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

// ─── BlacklistTab ─────────────────────────────────────────────────────────────

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
                        {label && <span className='text-sky-300 font-medium text-xs uppercase shrink-0'>{label}</span>}
                        <span className='text-muted font-mono text-xs truncate flex-1'>{addr}</span>
                        <button
                            type='button' title='Remove from blacklist'
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

// ─── SettingsDialog ───────────────────────────────────────────────────────────

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
                    {tab === 'labels'    && <LabelsTab />}
                    {tab === 'blacklist' && <BlacklistTab />}
                </div>
            </DialogContent>
        </Dialog>
    )
}
