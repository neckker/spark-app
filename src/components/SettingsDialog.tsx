import React from 'react'
import toast from 'react-hot-toast'
import { openUrl } from '@tauri-apps/plugin-opener'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useDebouncedCallback } from 'use-debounce'

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
    type FeesTerminal,
    type OpenMode,
    type FeesFilterMode,
    type Settings,
    type WalletLabels,
    type CreatorLabels,
    type CreatorBlacklist,
} from '@/context/SettingsContext'
import { useAuth } from '@/context/AuthContext'
import http from '@/lib/http'
import {
    AlertCircle,
    Ban,
    Check,
    Clock4,
    Copy,
    KeyRound,
    Plus,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Tag,
    Users,
    X,
    Info,
    Zap,
    Download,
    Upload,
} from 'lucide-react'

import pumpIcon   from '@/assets/pump.svg'
import mayhemIcon from '@/assets/mayhem.svg'
import bonkIcon   from '@/assets/bonk.svg'
import axiomIcon from '@/assets/terminals/axiom.svg'
import padreIcon from '@/assets/terminals/padre.svg'
import gmgnIcon from '@/assets/terminals/gmgn.svg'

// --- types ---

type Tab = 'main' | 'referral' | 'labels' | 'blacklist' | 'whitelist'

type FieldKey = 'devMin' | 'devMax' | 'migrationPct' | 'feesFilterValue' | 'minFundingAmount' | 'maxFundingAmount' | 'maxFundingAge' | 'minCommunityMembers' | 'maxCommunityMembers' | 'minCreatorFollowers' | 'maxCreatorFollowers' | 'maxCommunityAge' | 'maxCreatorAge'
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
    { id: 'referral',  label: 'Referral'  },
    { id: 'labels',    label: 'Labels'    },
    { id: 'blacklist', label: 'Blacklist' },
    { id: 'whitelist', label: 'Whitelist' },
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
    max_activations:  { icon: ShieldAlert, color: 'text-red-400',     label: 'Limit reached'   },
    not_activated:    { icon: ShieldAlert, color: 'text-amber-400',   label: 'Not activated'   },
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

const parsePositiveNum = (raw: string) => {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: true as const, value: 0 }
    const n = Number(cleaned)
    if (!Number.isFinite(n) || n < 0) return { ok: false as const, error: 'Must be ≥ 0' }
    return { ok: true as const, value: Math.floor(n) }
}

const fmtDate = (tsMs: number) =>
    tsMs
        ? new Date(tsMs).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
        : '0.0'

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
    const labels: Record<FeesFilterMode, string> = { total: 'Total', average: 'Average', each: 'Each' }
    return (
        <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
            {(['total', 'average', 'each'] as FeesFilterMode[]).map(mode => (
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
                    {labels[mode]}
                </button>
            ))}
        </div>
    )
}

// --- fees terminal picker ---

const FEES_TERMINALS: { id: FeesTerminal; label: string; icon: string }[] = [
    { id: 'gmgn',  label: 'GMGN',  icon: gmgnIcon  },
    { id: 'axiom', label: 'Axiom', icon: axiomIcon },
]

function FeesTerminalPicker({
    value,
    onChange,
    disabled,
}: {
    value: FeesTerminal
    onChange: (t: FeesTerminal) => void
    disabled?: boolean
}) {
    return (
        <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
            {FEES_TERMINALS.map(t => (
                <button
                    key={t.id}
                    type='button'
                    disabled={disabled}
                    onClick={() => onChange(t.id)}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1 cursor-pointer text-xs font-medium transition-colors',
                        value === t.id
                            ? 'bg-white/10 text-white'
                            : 'text-muted hover:text-zinc-300',
                        disabled && 'opacity-40 cursor-not-allowed',
                    )}
                >
                    <img src={t.icon} alt={t.label} className='h-3.5 w-3.5' draggable={false} />
                    {t.label}
                </button>
            ))}
        </div>
    )
}

// --- main tab ---

type MainView = 'filters' | 'app' | 'config'

function MainTab({ settings, store }: {
    settings: ReturnType<typeof useSettings>['settings']
    store: ReturnType<typeof useSettings>['store']
}) {
    const { patch } = useSettings()
    const [view, setView] = React.useState<MainView>('filters')

    // --- filter state ---
    const [devMin,               setDevMin]               = React.useState(String(settings.devMin))
    const [devMax,               setDevMax]               = React.useState(String(settings.devMax))
    const [migration,            setMigration]            = React.useState(String(settings.migrationPct))
    const [showPump,             setShowPump]              = React.useState(settings.showPump)
    const [showMayhem,           setShowMayhem]            = React.useState(settings.showMayhem)
    const [showBonk,             setShowBonk]              = React.useState(settings.showBonk)
    const [feesFilterEnabled,    setFeesFilterEnabled]    = React.useState(settings.feesFilterEnabled)
    const [feesFilterMode,       setFeesFilterMode]       = React.useState<FeesFilterMode>(settings.feesFilterMode)
    const [feesFilterValue,      setFeesFilterValue]      = React.useState(String(settings.feesFilterValue))
    const [feesTerminal,         setFeesTerminal]         = React.useState<FeesTerminal>(settings.feesTerminal)
    const [devHoldEnabled,       setDevHoldEnabled]       = React.useState(settings.devHoldEnabled)
    const [migrationEnabled,     setMigrationEnabled]     = React.useState(settings.migrationEnabled)
    const [lastTokenMigrated,   setLastTokenMigrated]    = React.useState(settings.lastTokenMigrated)
    const [fundingEnabled,       setFundingEnabled]       = React.useState(settings.fundingEnabled)
    const [minFundingAmount,     setMinFundingAmount]     = React.useState(String(settings.minFundingAmount))
    const [maxFundingAmount,     setMaxFundingAmount]     = React.useState(String(settings.maxFundingAmount))
    const [maxFundingAge,        setMaxFundingAge]        = React.useState(String(settings.maxFundingAge))
    const [communityEnabled,     setCommunityEnabled]     = React.useState(settings.communityEnabled)
    const [onlyCommunity,        setOnlyCommunity]        = React.useState(settings.onlyCommunity)
    const [minCommunityMembers,  setMinCommunityMembers]  = React.useState(String(settings.minCommunityMembers))
    const [maxCommunityMembers,  setMaxCommunityMembers]  = React.useState(String(settings.maxCommunityMembers))
    const [minCreatorFollowers,  setMinCreatorFollowers]  = React.useState(String(settings.minCreatorFollowers))
    const [maxCreatorFollowers,  setMaxCreatorFollowers]  = React.useState(String(settings.maxCreatorFollowers))
    const [maxCommunityAge,     setMaxCommunityAge]     = React.useState(String(settings.maxCommunityAge))
    const [maxCreatorAge,       setMaxCreatorAge]       = React.useState(String(settings.maxCreatorAge))
    // --- app settings state ---
    const [openInBrowser, setOpenInBrowser] = React.useState(settings.openInBrowser)
    const [openMode,      setOpenMode]      = React.useState<OpenMode>(settings.openMode)
    const [terminal,      setTerminal]      = React.useState<Terminal>(settings.terminal)
    const [uiScale,       setUIScale]       = React.useState(settings.uiScale)
    const [soundEnabled,  setSoundEnabled]  = React.useState(settings.soundEnabled)
    const [soundVolume,   setSoundVolume]   = React.useState(settings.soundVolume)

    const [errors, setErrors] = React.useState<Errors>({})
    const skipAutoSave = React.useRef(true)
    const isSaving = React.useRef(false)

    // Sync from external settings changes (skip when we initiated the save)
    React.useEffect(() => {
        if (isSaving.current) {
            isSaving.current = false
            return
        }
        skipAutoSave.current = true
        setDevMin(String(settings.devMin))
        setDevMax(String(settings.devMax))
        setMigration(String(settings.migrationPct))
        setShowPump(settings.showPump)
        setShowMayhem(settings.showMayhem)
        setShowBonk(settings.showBonk)
        setFeesFilterEnabled(settings.feesFilterEnabled)
        setFeesFilterMode(settings.feesFilterMode)
        setFeesFilterValue(String(settings.feesFilterValue))
        setFeesTerminal(settings.feesTerminal)
        setDevHoldEnabled(settings.devHoldEnabled)
        setMigrationEnabled(settings.migrationEnabled)
        setLastTokenMigrated(settings.lastTokenMigrated)
        setFundingEnabled(settings.fundingEnabled)
        setMinFundingAmount(String(settings.minFundingAmount))
        setMaxFundingAmount(String(settings.maxFundingAmount))
        setMaxFundingAge(String(settings.maxFundingAge))
        setCommunityEnabled(settings.communityEnabled)
        setOnlyCommunity(settings.onlyCommunity)
        setMinCommunityMembers(String(settings.minCommunityMembers))
        setMaxCommunityMembers(String(settings.maxCommunityMembers))
        setMinCreatorFollowers(String(settings.minCreatorFollowers))
        setMaxCreatorFollowers(String(settings.maxCreatorFollowers))
        setMaxCommunityAge(String(settings.maxCommunityAge))
        setMaxCreatorAge(String(settings.maxCreatorAge))
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
        let migValue = 5
        if (!migCleaned) {
            next.migrationPct = 'err'
        } else {
            const n = Number(migCleaned)
            if (!Number.isFinite(n)) next.migrationPct = 'err'
            else if (n < 5) next.migrationPct = 'err'
            else migValue = Math.min(100, n)
        }

        if (!min.ok) next.devMin = 'err'
        else if (min.value < 0.1) next.devMin = 'err'
        if (!max.ok) next.devMax = 'err'
        if (feesFilterEnabled && !fees.ok) next.feesFilterValue = 'err'

        if (min.ok && max.ok && !next.devMin && min.value > max.value) {
            next.devMin = 'err'
            next.devMax = 'err'
        }

        const fundMin = parseSol(minFundingAmount)
        const fundMax = parseSol(maxFundingAmount)
        const fundAge = parsePositiveNum(maxFundingAge)
        if (!fundMin.ok) next.minFundingAmount = 'err'
        if (!fundMax.ok) next.maxFundingAmount = 'err'
        if (!fundAge.ok) next.maxFundingAge = 'err'

        const comMin  = parsePositiveNum(minCommunityMembers)
        const comMax  = parsePositiveNum(maxCommunityMembers)
        const creatMin = parsePositiveNum(minCreatorFollowers)
        const creatMax = parsePositiveNum(maxCreatorFollowers)

        const comAge = parsePositiveNum(maxCommunityAge)
        const creatAge = parsePositiveNum(maxCreatorAge)

        if (!comMin.ok)  next.minCommunityMembers = 'err'
        if (!comMax.ok)  next.maxCommunityMembers = 'err'
        if (!creatMin.ok) next.minCreatorFollowers = 'err'
        if (!creatMax.ok) next.maxCreatorFollowers = 'err'
        if (!comAge.ok) next.maxCommunityAge = 'err'
        if (!creatAge.ok) next.maxCreatorAge = 'err'

        setErrors(next)

        return {
            ok: Object.keys(next).length === 0,
            values: {
                devMin:              min.ok ? Math.max(0.1, min.value) : 0.1,
                devMax:              max.ok ? max.value : 77,
                devHoldEnabled,
                migrationPct:        migValue,
                migrationEnabled,
                lastTokenMigrated,
                showPump,
                showMayhem,
                showBonk,
                feesFilterEnabled,
                feesFilterMode,
                feesFilterValue:     fees.ok ? fees.value : 1,
                feesTerminal,
                fundingEnabled,
                minFundingAmount:    fundMin.ok ? fundMin.value : 0,
                maxFundingAmount:    fundMax.ok ? fundMax.value : 0,
                maxFundingAge:       fundAge.ok ? fundAge.value : 0,
                communityEnabled,
                onlyCommunity,
                minCommunityMembers: comMin.ok  ? comMin.value  : 0,
                maxCommunityMembers: comMax.ok  ? comMax.value  : 0,
                minCreatorFollowers: creatMin.ok ? creatMin.value : 0,
                maxCreatorFollowers: creatMax.ok ? creatMax.value : 0,
                maxCommunityAge:    comAge.ok   ? comAge.value   : 0,
                maxCreatorAge:      creatAge.ok ? creatAge.value : 0,
                openInBrowser,
                openMode,
                terminal,
                uiScale,
                soundEnabled,
                soundVolume,
            },
        }
    }

    // Debounced auto-save
    const autoSave = useDebouncedCallback(async () => {
        if (!store) return
        const res = validate()
        if (!res.ok) return
        try {
            isSaving.current = true
            await patch(res.values)
            toast.success('Settings saved')
        } catch {
            isSaving.current = false
            toast.error('Failed to save settings')
        }
    }, 500)

    // Trigger auto-save on any state change
    React.useEffect(() => {
        if (skipAutoSave.current) {
            skipAutoSave.current = false
            return
        }
        autoSave()
    }, [devMin, devMax, devHoldEnabled, migration, migrationEnabled, lastTokenMigrated, showPump, showMayhem, showBonk, feesFilterEnabled, feesFilterMode, feesFilterValue, feesTerminal, fundingEnabled, minFundingAmount, maxFundingAmount, maxFundingAge, communityEnabled, onlyCommunity, minCommunityMembers, maxCommunityMembers, minCreatorFollowers, maxCreatorFollowers, maxCommunityAge, maxCreatorAge, openInBrowser, openMode, terminal, uiScale, soundEnabled, soundVolume])

    return (
        <div className='space-y-4'>
            <div className='px-1'>
                <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
                    {(['filters', 'app', 'config'] as MainView[]).map(v => (
                        <button
                            key={v}
                            type='button'
                            onClick={() => setView(v)}
                            className={cn(
                                'flex-1 rounded-[5px] px-3 py-1.5 text-xs cursor-pointer font-medium transition-colors',
                                view === v ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                            )}
                        >
                            {v === 'filters' ? 'Filters' : v === 'app' ? 'Application' : 'Config'}
                        </button>
                    ))}
                </div>
            </div>

            {view === 'filters' && (
                <div className='space-y-4 px-1 py-2'>
                    {/* ── DEV FILTERS ── */}
                    <SectionLabel>Dev Filters</SectionLabel>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                        <RowSwitch
                            label='Dev Holdings'
                            description='Filter by developer token holding percentage'
                            checked={devHoldEnabled}
                            onCheckedChange={setDevHoldEnabled}
                        />
                        {devHoldEnabled && (
                            <>
                                <Separator className='opacity-80' />
                                <div className='space-y-2'>
                                    <Label className='text-xs text-muted'>Holdings %</Label>
                                    <div className='grid grid-cols-2 gap-3'>
                                        <SuffixInput value={devMin} onChange={setDevMin} suffix='MIN' placeholder='0.1' error={!!errors.devMin} />
                                        <SuffixInput value={devMax} onChange={setDevMax} suffix='MAX' placeholder='77'  error={!!errors.devMax} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                        <RowSwitch
                            label='Migration'
                            description='Filter by dev migration success rate'
                            checked={migrationEnabled}
                            onCheckedChange={setMigrationEnabled}
                        />
                        {migrationEnabled && (
                            <>
                                <Separator className='opacity-80' />
                                <div className='space-y-2'>
                                    <Label className='text-xs text-muted'>Rate (% of migrated tokens from all dev tokens)</Label>
                                    <SuffixInput value={migration} onChange={setMigration} suffix='MIN' placeholder='15' error={!!errors.migrationPct} />
                                    <div className='flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-sky-500/8 ring-1 ring-sky-500/20'>
                                        <Info className='h-3.5 w-3.5 text-sky-400 shrink-0' />
                                        <p className='text-[11px] text-sky-200/70'>
                                            Minimum <span className='font-semibold text-white'>5%</span>
                                        </p>
                                    </div>
                                </div>
                                <Separator className='opacity-80' />
                                <RowSwitch
                                    label='Last Token Migrated'
                                    description='Require the most recent dev token to be migrated'
                                    checked={lastTokenMigrated}
                                    onCheckedChange={setLastTokenMigrated}
                                />
                            </>
                        )}
                    </div>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                        <RowSwitch
                            label='Funding Filter'
                            description='Filter by dev wallet funding amount and age'
                            checked={fundingEnabled}
                            onCheckedChange={setFundingEnabled}
                        />
                        {fundingEnabled && (
                            <>
                                <Separator className='opacity-80' />
                                <div className='space-y-2'>
                                    <Label className='text-xs text-muted'>Amount (SOL funded to dev wallet)</Label>
                                    <div className='grid grid-cols-2 gap-3'>
                                        <SuffixInput value={minFundingAmount} onChange={setMinFundingAmount} suffix='MIN' placeholder='0' error={!!errors.minFundingAmount} />
                                        <SuffixInput value={maxFundingAmount} onChange={setMaxFundingAmount} suffix='MAX' placeholder='0' error={!!errors.maxFundingAmount} />
                                    </div>
                                </div>
                                <div className='space-y-2'>
                                    <Label className='text-xs text-muted'>Age (hours since funding tx)</Label>
                                    <SuffixInput value={maxFundingAge} onChange={setMaxFundingAge} suffix='HR' placeholder='0' error={!!errors.maxFundingAge} />
                                    <div className='flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-amber-500/8 ring-1 ring-amber-500/20'>
                                        <Info className='h-3.5 w-3.5 text-amber-400 shrink-0' />
                                        <p className='text-[11px] text-amber-200/70'>
                                            <span className='font-semibold text-white'>SOL</span> amount and age in <span className='font-semibold text-white'>hours</span>
                                            {' · '}<span className='font-semibold text-white'>0</span> = disabled
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── TOKEN FILTERS ── */}
                    <SectionLabel>Token Filters</SectionLabel>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-2'>
                        <div className='flex items-center justify-between'>
                            <div>
                                <p className='text-sm font-medium text-white'>Protocols</p>
                                <p className='text-xs text-muted'>Show or hide tokens by launch protocol</p>
                            </div>
                        </div>
                        <div className='grid grid-cols-3 gap-2'>
                            {([
                                { key: 'pump',    icon: pumpIcon,   label: 'Pump',    active: showPump,    set: setShowPump,    color: '#22c55e' },
                                { key: 'mayhem',  icon: mayhemIcon, label: 'Mayhem',  active: showMayhem,  set: setShowMayhem,  color: '#ef4444' },
                                { key: 'bonk',    icon: bonkIcon,   label: 'Bonk',    active: showBonk,    set: setShowBonk,    color: '#d97706' },
                            ] as const).map(p => (
                                <button
                                    key={p.key}
                                    type='button'
                                    onClick={() => p.set(v => !v)}
                                    className='flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all cursor-pointer'
                                    style={{
                                        backgroundColor: `${p.color}15`,
                                        color: p.color,
                                        boxShadow: `inset 0 0 0 1px ${p.color}40`,
                                        opacity: p.active ? 1 : 0.35,
                                    }}
                                >
                                    <img src={p.icon} alt={p.label} className='h-4 w-4' draggable={false} />
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                        <RowSwitch
                            label='Fees Filter'
                            description="Filter by dev's fee history on previous tokens"
                            checked={feesFilterEnabled}
                            onCheckedChange={setFeesFilterEnabled}
                        />
                        {feesFilterEnabled && (
                            <>
                                <Separator className='opacity-80' />
                                <div className='space-y-3'>
                                    <div className='space-y-1.5'>
                                        <Label className='text-xs text-muted'>Terminal</Label>
                                        <FeesTerminalPicker value={feesTerminal} onChange={setFeesTerminal} />
                                        <div className='flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-rose-500/8 ring-1 ring-rose-500/20'>
                                            <Info className='h-3.5 w-3.5 text-rose-400 shrink-0' />
                                            <p className='text-[11px] text-rose-200/70'>
                                                Data source for token fee history analysis
                                            </p>
                                        </div>
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label className='text-xs text-muted'>Calculation Mode</Label>
                                        <FeesFilterModeToggle value={feesFilterMode} onChange={setFeesFilterMode} />
                                        <div className='flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-cyan-500/8 ring-1 ring-cyan-500/20'>
                                            <Info className='h-3.5 w-3.5 text-cyan-400 shrink-0' />
                                            <p className='text-[11px] text-cyan-200/70'>
                                                {feesFilterMode === 'total'
                                                    ? 'Sum of fees across all tracked tokens must exceed the threshold'
                                                    : feesFilterMode === 'average'
                                                    ? 'Average fee per token must exceed the threshold'
                                                    : 'Each token must individually exceed the threshold'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label className='text-xs text-muted'>Threshold</Label>
                                        <SuffixInput value={feesFilterValue} onChange={setFeesFilterValue} suffix='SOL' placeholder='1' error={!!errors.feesFilterValue} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── X/TWITTER COMMUNITY ── */}
                    <SectionLabel>X/Twitter Community</SectionLabel>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                        <RowSwitch
                            label='Community Tokens Only'
                            description='Show only tokens with an attached X community'
                            checked={onlyCommunity}
                            onCheckedChange={setOnlyCommunity}
                        />
                        <Separator className='opacity-80' />
                        <RowSwitch
                            label='Community Filter'
                            description='Filter by X/Twitter community stats'
                            checked={communityEnabled}
                            onCheckedChange={setCommunityEnabled}
                        />
                        {communityEnabled && (
                            <>
                                <Separator className='opacity-80' />
                                <div className='space-y-2'>
                                    <Label className='text-xs text-muted'>Community Members</Label>
                                    <div className='grid grid-cols-2 gap-3'>
                                        <SuffixInput value={minCommunityMembers} onChange={setMinCommunityMembers} suffix='MIN' placeholder='0' error={!!errors.minCommunityMembers} />
                                        <SuffixInput value={maxCommunityMembers} onChange={setMaxCommunityMembers} suffix='MAX' placeholder='0' error={!!errors.maxCommunityMembers} />
                                    </div>
                                </div>
                                <div className='space-y-2'>
                                    <Label className='text-xs text-muted'>Creator Followers</Label>
                                    <div className='grid grid-cols-2 gap-3'>
                                        <SuffixInput value={minCreatorFollowers} onChange={setMinCreatorFollowers} suffix='MIN' placeholder='0' error={!!errors.minCreatorFollowers} />
                                        <SuffixInput value={maxCreatorFollowers} onChange={setMaxCreatorFollowers} suffix='MAX' placeholder='0' error={!!errors.maxCreatorFollowers} />
                                    </div>
                                </div>
                                <div className='space-y-2'>
                                    <div className='grid grid-cols-2 gap-3'>
                                        <div className='space-y-1.5'>
                                            <Label className='text-xs text-muted'>Max Community Age</Label>
                                            <SuffixInput value={maxCommunityAge} onChange={setMaxCommunityAge} suffix='HR' placeholder='0' error={!!errors.maxCommunityAge} />
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label className='text-xs text-muted'>Max Creator Age</Label>
                                            <SuffixInput value={maxCreatorAge} onChange={setMaxCreatorAge} suffix='HR' placeholder='0' error={!!errors.maxCreatorAge} />
                                        </div>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-violet-500/8 ring-1 ring-violet-500/20'>
                                        <Info className='h-3.5 w-3.5 text-violet-400 shrink-0' />
                                        <p className='text-[11px] text-violet-200/70'>
                                            Only for tokens with <span className='font-semibold text-white'>X Community</span>
                                            {' · '}<span className='font-semibold text-white'>0</span> = disabled
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {view === 'app' && (
                <div className='space-y-4 px-1 py-2'>
                    <div className='space-y-1.5'>
                        <Label className='text-xs text-muted'>Terminal</Label>
                        <TerminalPicker value={terminal} onChange={setTerminal} />
                    </div>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                        <RowSwitch
                            label='Auto-Open Token'
                            description='Automatically open new tokens in browser'
                            checked={openInBrowser}
                            onCheckedChange={setOpenInBrowser}
                        />
                        {openInBrowser && (
                            <>
                                <Separator className='opacity-80' />
                                <div className='space-y-1.5'>
                                    <Label className='text-xs text-muted'>Open Mode</Label>
                                    <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
                                        {(['new-tab', 'current-tab'] as OpenMode[]).map(mode => (
                                            <button
                                                key={mode}
                                                type='button'
                                                onClick={() => setOpenMode(mode)}
                                                className={cn(
                                                    'flex-1 rounded-[5px] px-3 py-1 text-xs cursor-pointer font-medium transition-colors',
                                                    openMode === mode ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                                                )}
                                            >
                                                {mode === 'new-tab' ? 'New Tab' : 'Current Tab'}
                                            </button>
                                        ))}
                                    </div>
                                    {openMode === 'current-tab' && (
                                        <div className='flex items-center gap-2 rounded-md bg-amber-500/8 ring-1 ring-amber-500/15 px-2.5 py-1.5 mt-1'>
                                            <span className='text-amber-400 text-xs'>✨</span>
                                            <p className='text-xs text-amber-300 flex-1'>Requires <span className='font-semibold text-white'>Spark Opener</span> Extension</p>
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
                            </>
                        )}
                    </div>

                    <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
                        <RowSwitch
                            label='Sound Notifications'
                            description='Play a sound when a new token passes filters'
                            checked={soundEnabled}
                            onCheckedChange={setSoundEnabled}
                        />
                        {soundEnabled && (
                            <>
                                <Separator className='opacity-80' />
                                <div className='space-y-1.5'>
                                    <div className='flex items-center justify-between'>
                                        <Label className='text-xs text-muted'>Volume</Label>
                                        <span className='text-xs font-semibold text-white tabular-nums'>{soundVolume}%</span>
                                    </div>
                                    <input
                                        type='range' min='0' max='100' step='5'
                                        value={soundVolume}
                                        onChange={e => setSoundVolume(Number(e.target.value))}
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
            )}

            {view === 'config' && (
                <ConfigView settings={settings} store={store} />
            )}
        </div>
    )
}

// --- config view ---

function buildExportConfig(
    settings: Settings,
    walletLabels: WalletLabels,
    creatorLabels: CreatorLabels,
    blacklist: Set<string>,
    creatorBlacklist: CreatorBlacklist,
    devWhitelist: Set<string>,
    creatorWhitelist: CreatorBlacklist,
) {
    return {
        app: {
            openInBrowser: settings.openInBrowser,
            openMode: settings.openMode,
            terminal: settings.terminal,
            uiScale: settings.uiScale,
            soundEnabled: settings.soundEnabled,
            soundVolume: settings.soundVolume,
        },
        filters: {
            devHold: {
                devMin: settings.devMin,
                devMax: settings.devMax,
                devHoldEnabled: settings.devHoldEnabled,
            },
            migration: {
                migrationPct: settings.migrationPct,
                migrationEnabled: settings.migrationEnabled,
                lastTokenMigrated: settings.lastTokenMigrated,
            },
            protocols: {
                showPump: settings.showPump,
                showMayhem: settings.showMayhem,
                showBonk: settings.showBonk,
            },
            fees: {
                feesFilterEnabled: settings.feesFilterEnabled,
                feesFilterMode: settings.feesFilterMode,
                feesFilterValue: settings.feesFilterValue,
                feesTerminal: settings.feesTerminal,
            },
            funding: {
                fundingEnabled: settings.fundingEnabled,
                minFundingAmount: settings.minFundingAmount,
                maxFundingAmount: settings.maxFundingAmount,
                maxFundingAge: settings.maxFundingAge,
            },
            community: {
                communityEnabled: settings.communityEnabled,
                onlyCommunity: settings.onlyCommunity,
                minCommunityMembers: settings.minCommunityMembers,
                maxCommunityMembers: settings.maxCommunityMembers,
                minCreatorFollowers: settings.minCreatorFollowers,
                maxCreatorFollowers: settings.maxCreatorFollowers,
                maxCommunityAge: settings.maxCommunityAge,
                maxCreatorAge: settings.maxCreatorAge,
            },
        },
        labels: {
            wallets: walletLabels,
            creators: creatorLabels,
        },
        blacklist: {
            wallets: [...blacklist],
            creators: creatorBlacklist,
        },
        whitelist: {
            wallets: [...devWhitelist],
            creators: creatorWhitelist,
        },
    }
}

type ConfigJson = ReturnType<typeof buildExportConfig>

function applyImportConfig(
    config: ConfigJson,
    patch: (partial: Partial<Settings>) => Promise<void>,
    store: NonNullable<ReturnType<typeof useSettings>['store']>,
) {
    const flat: Partial<Settings> = {}

    if (config.app) {
        if (typeof config.app.openInBrowser === 'boolean') flat.openInBrowser = config.app.openInBrowser
        if (typeof config.app.openMode === 'string') flat.openMode = config.app.openMode as OpenMode
        if (typeof config.app.terminal === 'string') flat.terminal = config.app.terminal as Terminal
        if (typeof config.app.uiScale === 'number') flat.uiScale = config.app.uiScale
        if (typeof config.app.soundEnabled === 'boolean') flat.soundEnabled = config.app.soundEnabled
        if (typeof config.app.soundVolume === 'number') flat.soundVolume = config.app.soundVolume
    }

    if (config.filters) {
        const f = config.filters
        if (f.devHold) {
            if (typeof f.devHold.devMin === 'number') flat.devMin = f.devHold.devMin
            if (typeof f.devHold.devMax === 'number') flat.devMax = f.devHold.devMax
            if (typeof f.devHold.devHoldEnabled === 'boolean') flat.devHoldEnabled = f.devHold.devHoldEnabled
        }
        if (f.migration) {
            if (typeof f.migration.migrationPct === 'number') flat.migrationPct = f.migration.migrationPct
            if (typeof f.migration.migrationEnabled === 'boolean') flat.migrationEnabled = f.migration.migrationEnabled
            if (typeof f.migration.lastTokenMigrated === 'boolean') flat.lastTokenMigrated = f.migration.lastTokenMigrated
        }
        if (f.protocols) {
            if (typeof f.protocols.showPump === 'boolean') flat.showPump = f.protocols.showPump
            if (typeof f.protocols.showMayhem === 'boolean') flat.showMayhem = f.protocols.showMayhem
            if (typeof f.protocols.showBonk === 'boolean') flat.showBonk = f.protocols.showBonk
        }
        if (f.fees) {
            if (typeof f.fees.feesFilterEnabled === 'boolean') flat.feesFilterEnabled = f.fees.feesFilterEnabled
            if (typeof f.fees.feesFilterMode === 'string') flat.feesFilterMode = f.fees.feesFilterMode as FeesFilterMode
            if (typeof f.fees.feesFilterValue === 'number') flat.feesFilterValue = f.fees.feesFilterValue
            if (typeof f.fees.feesTerminal === 'string') flat.feesTerminal = f.fees.feesTerminal as FeesTerminal
        }
        if (f.funding) {
            if (typeof f.funding.fundingEnabled === 'boolean') flat.fundingEnabled = f.funding.fundingEnabled
            if (typeof f.funding.minFundingAmount === 'number') flat.minFundingAmount = f.funding.minFundingAmount
            if (typeof f.funding.maxFundingAmount === 'number') flat.maxFundingAmount = f.funding.maxFundingAmount
            if (typeof f.funding.maxFundingAge === 'number') flat.maxFundingAge = f.funding.maxFundingAge
        }
        if (f.community) {
            if (typeof f.community.communityEnabled === 'boolean') flat.communityEnabled = f.community.communityEnabled
            if (typeof f.community.onlyCommunity === 'boolean') flat.onlyCommunity = f.community.onlyCommunity
            if (typeof f.community.minCommunityMembers === 'number') flat.minCommunityMembers = f.community.minCommunityMembers
            if (typeof f.community.maxCommunityMembers === 'number') flat.maxCommunityMembers = f.community.maxCommunityMembers
            if (typeof f.community.minCreatorFollowers === 'number') flat.minCreatorFollowers = f.community.minCreatorFollowers
            if (typeof f.community.maxCreatorFollowers === 'number') flat.maxCreatorFollowers = f.community.maxCreatorFollowers
            if (typeof f.community.maxCommunityAge === 'number') flat.maxCommunityAge = f.community.maxCommunityAge
            if (typeof f.community.maxCreatorAge === 'number') flat.maxCreatorAge = f.community.maxCreatorAge
        }
    }

    const promises: Promise<void>[] = []

    if (Object.keys(flat).length > 0) promises.push(patch(flat))

    if (config.labels) {
        const labels: { wallets?: Record<string, string>; creators?: Record<string, unknown> } = {}
        if (config.labels.wallets && typeof config.labels.wallets === 'object') labels.wallets = config.labels.wallets
        if (config.labels.creators && typeof config.labels.creators === 'object') labels.creators = config.labels.creators
        if (Object.keys(labels).length > 0) {
            promises.push(
                store.get<{ wallets: Record<string, string>; creators: Record<string, unknown> }>('labels')
                    .then(existing => store.set('labels', { ...existing, ...labels }))
                    .then(() => store.save())
            )
        }
    }

    if (config.blacklist) {
        const bl: { wallets?: string[]; creators?: Record<string, string> } = {}
        if (Array.isArray(config.blacklist.wallets)) bl.wallets = config.blacklist.wallets
        if (config.blacklist.creators && typeof config.blacklist.creators === 'object') bl.creators = config.blacklist.creators
        if (Object.keys(bl).length > 0) {
            promises.push(
                store.get<{ wallets: string[]; creators: Record<string, string> }>('blacklist')
                    .then(existing => store.set('blacklist', { ...existing, ...bl }))
                    .then(() => store.save())
            )
        }
    }

    if (config.whitelist) {
        const wl: { wallets?: string[]; creators?: Record<string, string> } = {}
        if (Array.isArray(config.whitelist.wallets)) wl.wallets = config.whitelist.wallets
        if (config.whitelist.creators && typeof config.whitelist.creators === 'object') wl.creators = config.whitelist.creators
        if (Object.keys(wl).length > 0) {
            promises.push(
                store.get<{ wallets: string[]; creators: Record<string, string> }>('whitelist')
                    .then(existing => store.set('whitelist', { ...existing, ...wl }))
                    .then(() => store.save())
            )
        }
    }

    return Promise.all(promises)
}

function ConfigView({ settings, store }: {
    settings: Settings
    store: ReturnType<typeof useSettings>['store']
}) {
    const {
        patch, walletLabels, creatorLabels,
        blacklist, creatorBlacklist,
        devWhitelist, creatorWhitelist,
    } = useSettings()

    const handleExport = async () => {
        if (!store) return
        const config = buildExportConfig(
            settings, walletLabels, creatorLabels,
            blacklist, creatorBlacklist,
            devWhitelist, creatorWhitelist,
        )
        const path = await save({
            title: 'Export Config',
            defaultPath: 'spark-config.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        if (!path) return
        await writeTextFile(path, JSON.stringify(config, null, 2))
        toast.success('Config exported')
    }

    const handleImport = async () => {
        if (!store) return
        const path = await open({
            title: 'Import Config',
            multiple: false,
            filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        if (!path) return
        try {
            const text = await readTextFile(path)
            const config = JSON.parse(text) as ConfigJson
            await applyImportConfig(config, patch, store)
            toast.success('Config imported - restart app to apply all changes')
        } catch {
            toast.error('Failed to parse config file')
        }
    }

    const handleCopyConfig = async () => {
        const config = buildExportConfig(
            settings, walletLabels, creatorLabels,
            blacklist, creatorBlacklist,
            devWhitelist, creatorWhitelist,
        )
        await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
        toast.success('Config copied')
    }

    return (
        <div className='space-y-4 px-1 py-2'>
            <SectionLabel>Export</SectionLabel>

            <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-3 space-y-3'>
                <div>
                    <div className='text-sm font-medium text-white'>Export Config</div>
                    <div className='text-xs text-muted mt-0.5'>Save or copy your current settings</div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                    <Button className='w-full' onClick={handleExport}>
                        <Download className='h-4 w-4' />
                        Save File
                    </Button>
                    <Button className='w-full' variant='ghost' onClick={handleCopyConfig}>
                        <Copy className='h-4 w-4' />
                        Copy JSON
                    </Button>
                </div>
            </div>

            <SectionLabel>Import</SectionLabel>

            <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-3 space-y-3'>
                <div>
                    <div className='text-sm font-medium text-white'>Import Config</div>
                    <div className='text-xs text-muted mt-0.5'>Load settings from a JSON file</div>
                </div>
                <Button className='w-full' onClick={handleImport}>
                    <Upload className='h-4 w-4' />
                    Import Config
                </Button>
            </div>
        </div>
    )
}

// --- access card (embedded in referral tab) ---

function AccessCard() {
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
        <>
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
                href='https://discord.gg/kzpyEHUdpj'
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
                Renew Access
            </a>
        </>
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
            const { data } = await http.get<{ referrer: { code: string; wallet: string; created_at: number; updated_at: number }; recent: RecentUsage[] }>(
                '/hub/referrer/open-stats', { params: { device_id: deviceId } }
            )
            const r = data.referrer
            setStats({
                code:       r.code,
                wallet:     r.wallet,
                uses:       data.recent.length,
                created_at: r.created_at,
                updated_at: r.updated_at,
                recent:     data.recent
            })
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
            const { data } = await http.post<{ code: string; wallet: string; created_at: number; updated_at: number }>(
                '/hub/referrer/', { device_id: deviceId, code: trimmedCode, wallet: trimmedWallet }
            )
            setStats({
                code:       data.code,
                wallet:     data.wallet,
                uses:       0,
                created_at: data.created_at,
                updated_at: data.updated_at,
                recent:     []
            })
            setCodeInput('')
            setWalletInput('')
            toast.success('Referral code created!')
        } catch (err: any) {
            const detail = err.response?.data?.detail
            if (detail === 'is_taken') setCodeError('This code is already taken.')
            else if (detail === 'is_exists') setCodeError('You already have a referral code.')
            else setCodeError('Something went wrong.')
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

            const { data } = await http.put<{ code: string; wallet: string; updated_at: number }>(
                '/hub/referrer/change', body
            )
            setStats(prev =>
                prev ? {
                    ...prev,
                    code:       data.code,
                    wallet:     data.wallet,
                    updated_at: data.updated_at
                } : null
            )
            cancelEdit()
            toast.success('Updated!')
        } catch (err: any) {
            const detail = err.response?.data?.detail
            if (detail === 'is_taken') setCodeError('This code is already taken.')
            else if (detail === 'same_code') setCodeError('This is already your current code.')
            else setCodeError('Something went wrong.')
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
            <div className='space-y-4 p-1'>
                <AccessCard />
                <div className='flex items-center justify-center py-10'>
                    <Spinner className='h-5 w-5 text-zinc-500' />
                </div>
            </div>
        )
    }

    // create form
    if (!stats) {
        return (
            <div className='space-y-4 p-1'>
                <AccessCard />
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
            <AccessCard />
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

type LabelsView = 'wallets' | 'creators'

function LabelsTab() {
    const { walletLabels, setWalletLabel, removeWalletLabel, creatorLabels, setCreatorLabel, removeCreatorLabel } = useSettings()
    const [view, setView] = React.useState<LabelsView>('wallets')
    const [search, setSearch] = React.useState('')
    const [showForm, setShowForm] = React.useState(false)

    // manual add state - wallets
    const [walletAddrInput, setWalletAddrInput] = React.useState('')
    const [walletLabelInput, setWalletLabelInput] = React.useState('')
    const [walletError, setWalletError] = React.useState<string | null>(null)

    // manual add state - creators
    const [creatorNameInput, setCreatorNameInput] = React.useState('')
    const [creatorLabelInput, setCreatorLabelInput] = React.useState('')
    const [creatorError, setCreatorError] = React.useState<string | null>(null)

    const walletEntries  = Object.entries(walletLabels).filter(([addr]) =>
        !search || addr.toLowerCase().includes(search.toLowerCase())
    )
    const creatorEntries = Object.entries(creatorLabels).filter(([, data]) =>
        !search || (data.screenName && data.screenName.toLowerCase().includes(search.toLowerCase()))
    )

    const handleAddWalletLabel = () => {
        const addr = walletAddrInput.trim()
        const label = walletLabelInput.trim()
        if (!addr) { setWalletError('Please enter a wallet address'); return }
        if (!SOLANA_WALLET_RE.test(addr)) { setWalletError('Invalid Solana wallet address'); return }
        if (!label) { setWalletError('Please enter a label'); return }
        void setWalletLabel(addr, label)
        setWalletAddrInput('')
        setWalletLabelInput('')
        setWalletError(null)
        toast.success('Wallet label added')
    }

    const handleAddCreatorLabel = () => {
        const name = creatorNameInput.trim().replace(/^@/, '')
        const label = creatorLabelInput.trim()
        if (!name) { setCreatorError('Please enter a screen name'); return }
        if (name.length > 30) { setCreatorError('Invalid screen name'); return }
        if (!label) { setCreatorError('Please enter a label'); return }
        void setCreatorLabel(name, label, '#7dd3fc')
        setCreatorNameInput('')
        setCreatorLabelInput('')
        setCreatorError(null)
        toast.success('Creator label added')
    }

    return (
        <div className='space-y-2'>
            {/* toggle */}
            <div className='px-1 pb-1 flex items-center gap-1.5'>
            <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8 flex-1'>
                {(['wallets', 'creators'] as LabelsView[]).map(v => (
                    <button
                        key={v}
                        type='button'
                        onClick={() => { setView(v); setSearch(''); setWalletError(null); setCreatorError(null) }}
                        className={cn(
                            'flex-1 rounded-[5px] px-3 py-1.5 text-xs cursor-pointer font-medium transition-colors',
                            view === v ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                        )}
                    >
                        {v === 'wallets' ? 'Wallet Labels' : 'Creator Labels'}
                    </button>
                ))}
            </div>
            <button
                type='button'
                title='Add manually'
                onClick={() => setShowForm(f => !f)}
                className={cn(
                    'shrink-0 rounded-[5px] px-2 py-1.75 ring-1 ring-white/8 transition-colors cursor-pointer',
                    showForm ? 'bg-white/10 text-white' : 'bg-white/5 text-muted hover:text-zinc-300',
                )}
            >
                <Plus className='h-3.5 w-3.5' />
            </button>
            </div>

            {/* wallet labels */}
            {view === 'wallets' && (
                <div className='space-y-2'>
                    {showForm && (<>
                        <Separator className='opacity-80' />
                        <div className='px-1 space-y-1.5'>
                            <div className='flex gap-2'>
                                <Input
                                    value={walletAddrInput}
                                    onChange={e => { setWalletAddrInput(e.target.value); setWalletError(null) }}
                                    placeholder='Wallet address…'
                                    className={cn('bg-white/5 border-white/10 font-mono text-sm flex-1', walletError && 'border-rose-500/60')}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddWalletLabel() }}
                                />
                                <Input
                                    value={walletLabelInput}
                                    onChange={e => setWalletLabelInput(e.target.value)}
                                    placeholder='Label…'
                                    className='bg-white/5 border-white/10 text-sm w-24'
                                    maxLength={10}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddWalletLabel() }}
                                />
                                <Button onClick={handleAddWalletLabel} className='shrink-0'>Add</Button>
                            </div>
                            {walletError && <FieldError message={walletError} />}
                        </div>
                        <Separator className='opacity-80' />
                    </>)}

                    {Object.keys(walletLabels).length > 0 && (
                        <div className='px-1'>
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder='Search by wallet address…'
                                className='bg-white/5 border-white/10 text-sm'
                            />
                        </div>
                    )}

                    {walletEntries.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                            <Tag className='h-8 w-8 opacity-30' />
                            <span className='text-sm'>{search ? 'No matches' : 'No Wallet Labels Yet'}</span>
                            {!search && <span className='text-xs opacity-60'>Add a label above or from any token card</span>}
                        </div>
                    ) : (
                        <div className='space-y-1.5 p-1'>
                            {walletEntries.map(([addr, label]) => (
                                <div key={addr} className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'>
                                    <span className='text-sky-300 font-medium text-xs uppercase shrink-0'>{label}</span>
                                    <span className='text-muted font-mono text-xs truncate flex-1'>{addr}</span>
                                    <button
                                        type='button'
                                        title='Remove Label'
                                        onClick={() => { void removeWalletLabel(addr); toast.success('Label removed') }}
                                        className='shrink-0 text-muted hover:text-rose-400 transition-colors cursor-pointer'
                                    >
                                        <X className='h-3.5 w-3.5' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* creator labels */}
            {view === 'creators' && (
                <div className='space-y-2'>
                    {showForm && (<>
                        <Separator className='opacity-80' />
                        <div className='px-1 space-y-1.5'>
                            <div className='flex gap-2'>
                                <Input
                                    value={creatorNameInput}
                                    onChange={e => { setCreatorNameInput(e.target.value); setCreatorError(null) }}
                                    placeholder='screen_name'
                                    className={cn('bg-white/5 border-white/10 text-sm flex-1', creatorError && 'border-rose-500/60')}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCreatorLabel() }}
                                />
                                <Input
                                    value={creatorLabelInput}
                                    onChange={e => setCreatorLabelInput(e.target.value)}
                                    placeholder='Label…'
                                    className='bg-white/5 border-white/10 text-sm w-24'
                                    maxLength={16}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCreatorLabel() }}
                                />
                                <Button onClick={handleAddCreatorLabel} className='shrink-0'>Add</Button>
                            </div>
                            {creatorError && <FieldError message={creatorError} />}
                        </div>
                        <Separator className='opacity-80' />
                    </>)}

                    {Object.keys(creatorLabels).length > 0 && (
                        <div className='px-1'>
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder='Search by creator name…'
                                className='bg-white/5 border-white/10 text-sm'
                            />
                        </div>
                    )}

                    {creatorEntries.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                            <Users className='h-8 w-8 opacity-30' />
                            <span className='text-sm'>{search ? 'No matches' : 'No Creator Labels Yet'}</span>
                            {!search && <span className='text-xs opacity-60'>Add a label above or from the hover card</span>}
                        </div>
                    ) : (
                        <div className='space-y-1.5 p-1'>
                            {creatorEntries.map(([screenName, data]) => (
                                <div key={screenName} className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'>
                                    <span
                                        className='font-medium text-xs uppercase shrink-0'
                                        style={{ color: data.color }}
                                    >
                                        {data.label}
                                    </span>
                                    <span className='text-muted text-xs truncate flex-1'>@{data.screenName || screenName}</span>
                                    <button
                                        type='button'
                                        title='Remove Label'
                                        onClick={() => { void removeCreatorLabel(screenName); toast.success('Creator label removed') }}
                                        className='shrink-0 text-muted hover:text-rose-400 transition-colors cursor-pointer'
                                    >
                                        <X className='h-3.5 w-3.5' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// --- blacklist tab ---

type BlacklistView = 'wallets' | 'creators'

function BlacklistTab() {
    const {
        blacklist, walletLabels, addToBlacklist, removeFromBlacklist,
        creatorBlacklist, addCreatorToBlacklist, removeCreatorFromBlacklist,
    } = useSettings()
    const [view, setView] = React.useState<BlacklistView>('wallets')
    const [search, setSearch] = React.useState('')
    const [showForm, setShowForm] = React.useState(false)

    // manual add state - wallets
    const [walletInput, setWalletInput] = React.useState('')
    const [walletError, setWalletError] = React.useState<string | null>(null)

    // manual add state - creators
    const [creatorInput, setCreatorInput] = React.useState('')
    const [creatorError, setCreatorError] = React.useState<string | null>(null)

    const walletEntries = [...blacklist].filter(addr =>
        !search || addr.toLowerCase().includes(search.toLowerCase())
    )
    const creatorEntries = Object.entries(creatorBlacklist).filter(([, screenName]) =>
        !search || (screenName && screenName.toLowerCase().includes(search.toLowerCase()))
    )

    const handleAddWallet = () => {
        const trimmed = walletInput.trim()
        if (!trimmed) { setWalletError('Please enter a wallet address'); return }
        if (!SOLANA_WALLET_RE.test(trimmed)) { setWalletError('Invalid Solana wallet address'); return }
        if (blacklist.has(trimmed)) { setWalletError('Already in blacklist'); return }
        void addToBlacklist(trimmed)
        setWalletInput('')
        setWalletError(null)
        toast.success('Added to blacklist')
    }

    const handleAddCreator = () => {
        const trimmed = creatorInput.trim().replace(/^@/, '')
        if (!trimmed) { setCreatorError('Please enter a screen name'); return }
        if (trimmed.length > 30) { setCreatorError('Invalid screen name'); return }
        const key = trimmed.toLowerCase()
        if (key in creatorBlacklist) { setCreatorError('Already in blacklist'); return }
        void addCreatorToBlacklist(trimmed)
        setCreatorInput('')
        setCreatorError(null)
        toast.success('Creator added to blacklist')
    }

    return (
        <div className='space-y-2'>
            {/* toggle */}
            <div className='px-1 pb-1 flex items-center gap-1.5'>
            <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8 flex-1'>
                {(['wallets', 'creators'] as BlacklistView[]).map(v => (
                    <button
                        key={v}
                        type='button'
                        onClick={() => { setView(v); setSearch(''); setWalletError(null); setCreatorError(null) }}
                        className={cn(
                            'flex-1 rounded-[5px] px-3 py-1.5 text-xs cursor-pointer font-medium transition-colors',
                            view === v ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                        )}
                    >
                        {v === 'wallets' ? 'Wallet Blacklist' : 'Creator Blacklist'}
                    </button>
                ))}
            </div>
            <button
                type='button'
                title='Add manually'
                onClick={() => setShowForm(f => !f)}
                className={cn(
                    'shrink-0 rounded-[5px] px-2 py-1.75 ring-1 ring-white/8 transition-colors cursor-pointer',
                    showForm ? 'bg-white/10 text-white' : 'bg-white/5 text-muted hover:text-zinc-300',
                )}
            >
                <Plus className='h-3.5 w-3.5' />
            </button>
            </div>

            {/* wallet blacklist */}
            {view === 'wallets' && (
                <div className='space-y-2'>
                    {showForm && (<>
                        <Separator className='opacity-80' />
                        <div className='px-1 space-y-1.5'>
                            <div className='flex gap-2'>
                                <Input
                                    value={walletInput}
                                    onChange={e => { setWalletInput(e.target.value); setWalletError(null) }}
                                    placeholder='Wallet address…'
                                    className={cn('bg-white/5 border-white/10 font-mono text-sm flex-1', walletError && 'border-rose-500/60')}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddWallet() }}
                                />
                                <Button onClick={handleAddWallet} className='shrink-0'>Add</Button>
                            </div>
                            {walletError && <FieldError message={walletError} />}
                        </div>
                        <Separator className='opacity-80' />
                    </>)}

                    {blacklist.size > 0 && (
                        <div className='px-1'>
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder='Search by wallet address…'
                                className='bg-white/5 border-white/10 text-sm'
                            />
                        </div>
                    )}

                    {walletEntries.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                            <Ban className='h-8 w-8 opacity-30' />
                            <span className='text-sm'>{search ? 'No matches' : 'No Blocked Wallets'}</span>
                            {!search && <span className='text-xs opacity-60'>Add a wallet above or ban from any token card</span>}
                        </div>
                    ) : (
                        <div className='space-y-1.5 p-1'>
                            {walletEntries.map(addr => {
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
                                            className='shrink-0 text-muted hover:text-rose-400 transition-colors cursor-pointer'
                                        >
                                            <X className='h-3.5 w-3.5' />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* creator blacklist */}
            {view === 'creators' && (
                <div className='space-y-2'>
                    {showForm && (<>
                        <Separator className='opacity-80' />
                        <div className='px-1 space-y-1.5'>
                            <div className='flex gap-2'>
                                <Input
                                    value={creatorInput}
                                    onChange={e => { setCreatorInput(e.target.value); setCreatorError(null) }}
                                    placeholder='screen_name'
                                    className={cn('bg-white/5 border-white/10 text-sm flex-1', creatorError && 'border-rose-500/60')}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCreator() }}
                                />
                                <Button onClick={handleAddCreator} className='shrink-0'>Add</Button>
                            </div>
                            {creatorError && <FieldError message={creatorError} />}
                        </div>
                        <Separator className='opacity-80' />
                    </>)}

                    {Object.keys(creatorBlacklist).length > 0 && (
                        <div className='px-1'>
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder='Search by creator name…'
                                className='bg-white/5 border-white/10 text-sm'
                            />
                        </div>
                    )}

                    {creatorEntries.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                            <Ban className='h-8 w-8 opacity-30' />
                            <span className='text-sm'>{search ? 'No matches' : 'No Blocked Creators'}</span>
                            {!search && <span className='text-xs opacity-60'>Add a creator above or block from the hover card</span>}
                        </div>
                    ) : (
                        <div className='space-y-1.5 p-1'>
                            {creatorEntries.map(([key, screenName]) => (
                                <div key={key} className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'>
                                    <span className='text-rose-300 font-medium text-xs shrink-0'>@{screenName || key}</span>
                                    <span className='flex-1' />
                                    <button
                                        type='button'
                                        title='Unblock creator'
                                        onClick={() => { void removeCreatorFromBlacklist(key); toast.success('Creator unblocked') }}
                                        className='shrink-0 text-muted hover:text-rose-400 transition-colors cursor-pointer'
                                    >
                                        <X className='h-3.5 w-3.5' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// --- whitelist tab ---

type WhitelistView = 'wallets' | 'creators'

function WhitelistTab() {
    const {
        walletLabels,
        devWhitelist, addToDevWhitelist, removeFromDevWhitelist,
        creatorWhitelist, addCreatorToWhitelist, removeCreatorFromWhitelist,
    } = useSettings()
    const [view, setView] = React.useState<WhitelistView>('wallets')
    const [search, setSearch] = React.useState('')
    const [showForm, setShowForm] = React.useState(false)
    const [walletInput, setWalletInput] = React.useState('')
    const [walletError, setWalletError] = React.useState<string | null>(null)
    const [creatorInput, setCreatorInput] = React.useState('')
    const [creatorError, setCreatorError] = React.useState<string | null>(null)

    const walletEntries = [...devWhitelist].filter(addr =>
        !search || addr.toLowerCase().includes(search.toLowerCase())
    )
    const creatorEntries = Object.entries(creatorWhitelist).filter(([, screenName]) =>
        !search || (screenName && screenName.toLowerCase().includes(search.toLowerCase()))
    )

    const handleAddWallet = () => {
        const trimmed = walletInput.trim()
        if (!trimmed) { setWalletError('Please enter a wallet address'); return }
        if (!SOLANA_WALLET_RE.test(trimmed)) { setWalletError('Invalid Solana wallet address'); return }
        if (devWhitelist.has(trimmed)) { setWalletError('Already in whitelist'); return }
        void addToDevWhitelist(trimmed)
        setWalletInput('')
        setWalletError(null)
        toast.success('Added to whitelist')
    }

    const handleAddCreator = () => {
        const trimmed = creatorInput.trim().replace(/^@/, '')
        if (!trimmed) { setCreatorError('Please enter a screen name'); return }
        if (trimmed.length < 1 || trimmed.length > 30) { setCreatorError('Invalid screen name'); return }
        const key = trimmed.toLowerCase()
        if (key in creatorWhitelist) { setCreatorError('Already in whitelist'); return }
        void addCreatorToWhitelist(trimmed)
        setCreatorInput('')
        setCreatorError(null)
        toast.success('Creator added to whitelist')
    }

    return (
        <div className='space-y-2'>
            {/* toggle */}
            <div className='px-1 pb-1 flex items-center gap-1.5'>
            <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8 flex-1'>
                {(['wallets', 'creators'] as WhitelistView[]).map(v => (
                    <button
                        key={v}
                        type='button'
                        onClick={() => { setView(v); setSearch('') }}
                        className={cn(
                            'flex-1 rounded-[5px] px-3 py-1.5 text-xs cursor-pointer font-medium transition-colors',
                            view === v ? 'bg-white/10 text-white' : 'text-muted hover:text-zinc-300',
                        )}
                    >
                        {v === 'wallets' ? 'Wallets' : 'Creators'}
                    </button>
                ))}
            </div>
            <button
                type='button'
                title='Add manually'
                onClick={() => setShowForm(f => !f)}
                className={cn(
                    'shrink-0 rounded-[5px] px-2 py-1.75 ring-1 ring-white/8 transition-colors cursor-pointer',
                    showForm ? 'bg-white/10 text-white' : 'bg-white/5 text-muted hover:text-zinc-300',
                )}
            >
                <Plus className='h-3.5 w-3.5' />
            </button>
            </div>

            {/* wallets whitelist */}
            {view === 'wallets' && (
                <div className='space-y-2'>
                    {showForm && (<>
                        <Separator className='opacity-80' />
                        <div className='px-1 space-y-1.5'>
                            <div className='flex gap-2'>
                                <Input
                                    value={walletInput}
                                    onChange={e => { setWalletInput(e.target.value); setWalletError(null) }}
                                    placeholder='Wallet address…'
                                    className={cn('bg-white/5 border-white/10 font-mono text-sm flex-1', walletError && 'border-rose-500/60')}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddWallet() }}
                                />
                                <Button onClick={handleAddWallet} className='shrink-0'>Add</Button>
                            </div>
                            {walletError && <FieldError message={walletError} />}
                            <div className='flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-emerald-500/8 ring-1 ring-emerald-500/20'>
                                <Info className='h-3.5 w-3.5 text-emerald-400 shrink-0' />
                                <p className='text-[11px] text-emerald-200/70'>
                                    Whitelisted wallets bypass all filters
                                </p>
                            </div>
                        </div>
                        <Separator className='opacity-80' />
                    </>)}

                    {devWhitelist.size > 0 && (
                        <div className='px-1'>
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder='Search by wallet address…'
                                className='bg-white/5 border-white/10 text-sm'
                            />
                        </div>
                    )}

                    {walletEntries.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                            <ShieldCheck className='h-8 w-8 opacity-30' />
                            <span className='text-sm'>{search ? 'No matches' : 'No Whitelisted Wallets'}</span>
                            {!search && <span className='text-xs opacity-60'>Add a wallet to bypass all filters</span>}
                        </div>
                    ) : (
                        <div className='space-y-1.5 p-1'>
                            {walletEntries.map(addr => {
                                const label = walletLabels[addr]
                                return (
                                    <div key={addr} className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'>
                                        {label && (
                                            <span className='text-emerald-300 font-medium text-xs uppercase shrink-0'>{label}</span>
                                        )}
                                        <span className='text-muted font-mono text-xs truncate flex-1'>{addr}</span>
                                        <button
                                            type='button'
                                            title='Remove from whitelist'
                                            onClick={() => { void removeFromDevWhitelist(addr); toast.success('Removed from whitelist') }}
                                            className='shrink-0 text-muted hover:text-rose-400 transition-colors cursor-pointer'
                                        >
                                            <X className='h-3.5 w-3.5' />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* creators whitelist */}
            {view === 'creators' && (
                <div className='space-y-2'>
                    {showForm && (<>
                        <Separator className='opacity-80' />
                        <div className='px-1 space-y-1.5'>
                            <div className='flex gap-2'>
                                <Input
                                    value={creatorInput}
                                    onChange={e => { setCreatorInput(e.target.value); setCreatorError(null) }}
                                    placeholder='screen_name'
                                    className={cn('bg-white/5 border-white/10 text-sm flex-1', creatorError && 'border-rose-500/60')}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCreator() }}
                                />
                                <Button onClick={handleAddCreator} className='shrink-0'>Add</Button>
                            </div>
                            {creatorError && <FieldError message={creatorError} />}
                            <div className='flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-emerald-500/8 ring-1 ring-emerald-500/20'>
                                <Info className='h-3.5 w-3.5 text-emerald-400 shrink-0' />
                                <p className='text-[11px] text-emerald-200/70'>
                                    Whitelisted creators bypass all filters
                                </p>
                            </div>
                        </div>
                        <Separator className='opacity-80' />
                    </>)}

                    {Object.keys(creatorWhitelist).length > 0 && (
                        <div className='px-1'>
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder='Search by creator name…'
                                className='bg-white/5 border-white/10 text-sm'
                            />
                        </div>
                    )}

                    {creatorEntries.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-10 gap-2 text-muted'>
                            <ShieldCheck className='h-8 w-8 opacity-30' />
                            <span className='text-sm'>{search ? 'No matches' : 'No Whitelisted Creators'}</span>
                            {!search && <span className='text-xs opacity-60'>Add a creator screen name to bypass all filters</span>}
                        </div>
                    ) : (
                        <div className='space-y-1.5 p-1'>
                            {creatorEntries.map(([id, screenName]) => (
                                <div key={id} className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'>
                                    <span className='text-emerald-300 font-medium text-xs shrink-0'>@{screenName}</span>
                                    <span className='flex-1' />
                                    <button
                                        type='button'
                                        title='Remove from whitelist'
                                        onClick={() => { void removeCreatorFromWhitelist(id); toast.success('Creator removed from whitelist') }}
                                        className='shrink-0 text-muted hover:text-rose-400 transition-colors cursor-pointer'
                                    >
                                        <X className='h-3.5 w-3.5' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// --- settings dialog ---

export default function SettingsDialog({ children }: { children: React.ReactNode }) {
    const { settings, store, ready } = useSettings()

    const [open, setOpen] = React.useState(false)
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
                className='sm:max-w-115 flex flex-col max-h-[85vh] gap-2'
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
                        <MainTab settings={settings} store={store} />
                    )}
                    {tab === 'referral'  && <ReferralTab />}
                    {tab === 'labels'    && <LabelsTab />}
                    {tab === 'blacklist' && <BlacklistTab />}
                    {tab === 'whitelist' && <WhitelistTab />}
                </div>
            </DialogContent>
        </Dialog>
    )
}
