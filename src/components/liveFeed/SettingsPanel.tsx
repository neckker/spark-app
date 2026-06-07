import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import toast from 'react-hot-toast'
import { openUrl } from '@tauri-apps/plugin-opener'

const SPARK_OPENER_STORE_URL =
    'https://chromewebstore.google.com/detail/cmdanpdcddmkknljllainkehfdbdjfbc'
import {
    AlertCircle,
    AppWindow,
    ClipboardPaste,
    Copy,
    FileCog,
    Filter,
    Info,
    type LucideIcon
} from 'lucide-react'

import bonkIcon from '@/assets/protocols/bonk.svg'
import pumpIcon from '@/assets/protocols/pump.svg'
import mayhemIcon from '@/assets/protocols/mayhem.svg'
import axiomIcon from '@/assets/terminals/axiom.svg'
import padreIcon from '@/assets/terminals/padre.svg'
import gmgnIcon from '@/assets/terminals/gmgn.svg'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

import { useTokenAnalyzer } from '@/context/TokenAnalyzerContext'
import { cn } from '@/lib/utils'
import { defaultConfig, normalizeApp } from '@/lib/liveFeedDefaults'
import {
    SCHEMA_VERSION,
    type FeesMode,
    type FeesSource,
    type Filters,
    type LiveFeedConfig,
    type Terminal
} from '@/types/liveFeed'

type Tab = 'filters' | 'app' | 'config'

type FieldKey =
    | 'devMin' | 'devMax'
    | 'migrationPct'
    | 'feesValue'
    | 'fundingAmountMin' | 'fundingAmountMax'
    | 'fundingAgeMin' | 'fundingAgeMax'

type Errors = Partial<Record<FieldKey, string>>

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
    { id: 'filters', label: 'Filters', Icon: Filter },
    { id: 'app', label: 'Application', Icon: AppWindow },
    { id: 'config', label: 'Config', Icon: FileCog }
]

const TERMINALS: { id: Terminal; label: string; icon: string; url: string }[] = [
    { id: 'axiom', label: 'Axiom', icon: axiomIcon, url: 'axiom.trade' },
    { id: 'padre', label: 'Padre', icon: padreIcon, url: 'padre.gg' },
    { id: 'gmgn', label: 'GMGN', icon: gmgnIcon, url: 'gmgn.ai' }
]

const FEES_TERMINALS: { id: FeesSource; label: string; icon: string }[] = [
    { id: 'gmgn', label: 'GMGN', icon: gmgnIcon },
    { id: 'axiom', label: 'Axiom', icon: axiomIcon }
]

const PROTOCOL_BUTTONS = [
    { key: 'pump', icon: pumpIcon, label: 'Pump', color: '#22c55e' },
    { key: 'mayhem', icon: mayhemIcon, label: 'Mayhem', color: '#ef4444' },
    { key: 'bonk', icon: bonkIcon, label: 'Bonk', color: '#d97706' }
] as const

type InfoNoteTone = 'sky' | 'amber' | 'rose' | 'cyan' | 'violet' | 'emerald'

const INFO_NOTE_TONE: Readonly<Record<InfoNoteTone, {
    bg: string; ring: string; icon: string; text: string
}>> = {
    sky: { bg: 'bg-sky-500/8', ring: 'ring-sky-500/20', icon: 'text-sky-400', text: 'text-sky-200/70' },
    amber: { bg: 'bg-amber-500/8', ring: 'ring-amber-500/20', icon: 'text-amber-400', text: 'text-amber-200/70' },
    rose: { bg: 'bg-rose-500/8', ring: 'ring-rose-500/20', icon: 'text-rose-400', text: 'text-rose-200/70' },
    cyan: { bg: 'bg-cyan-500/8', ring: 'ring-cyan-500/20', icon: 'text-cyan-400', text: 'text-cyan-200/70' },
    violet: { bg: 'bg-violet-500/8', ring: 'ring-violet-500/20', icon: 'text-violet-400', text: 'text-violet-200/70' },
    emerald: { bg: 'bg-emerald-500/8', ring: 'ring-emerald-500/20', icon: 'text-emerald-400', text: 'text-emerald-200/70' }
}

const PROTOCOL_FILTER_KEY: Record<
    'pump' | 'mayhem' | 'bonk',
    'showPump' | 'showMayhem' | 'showBonk'
> = {
    pump: 'showPump',
    mayhem: 'showMayhem',
    bonk: 'showBonk'
}

const normalize = (v: string) => v.trim().replace(',', '.')

function parsePercent(raw: string): { ok: true; value: number } | { ok: false } {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: false }
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return { ok: false }
    return { ok: true, value: Math.max(0, Math.min(100, n)) }
}

function parseSol(raw: string): { ok: true; value: number } | { ok: false } {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: false }
    const n = Number(cleaned)
    if (!Number.isFinite(n) || n < 0) return { ok: false }
    return { ok: true, value: n }
}

type OptionalNum = { ok: true; value: number | null } | { ok: false }

function parseOptionalNum(raw: string): OptionalNum {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: true, value: null }
    const n = Number(cleaned)
    if (!Number.isFinite(n) || n < 0) return { ok: false }
    return { ok: true, value: n }
}

const fmtNum = (n: number | null) => (n == null ? '' : String(n))

export function SettingsPanel({
    open,
    onClose
}: {
    open: boolean
    onClose: () => void
}) {
    const [tab, setTab] = useState<Tab>('filters')

    useEffect(() => {
        if (open) setTab('filters')
    }, [open])

    const activeMeta = TABS.find((t) => t.id === tab) ?? TABS[0]

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
            <DialogContent>
                <div className='flex items-center gap-3'>
                    <div className='flex-1 min-w-0'>
                        <DialogTitle>{activeMeta.label}</DialogTitle>
                        <DialogDescription className='mt-1 text-muted'>
                            Tune the feed
                        </DialogDescription>
                    </div>

                    <IconNav active={tab} onChange={setTab} />
                </div>

                <div className='flex-1 overflow-y-auto scrollbar-hide min-h-0 -mx-1 px-1'>
                    {tab === 'filters' && <FiltersTab />}
                    {tab === 'app' && <AppTab />}
                    {tab === 'config' && <ConfigTab />}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function IconNav({
    active,
    onChange
}: {
    active: Tab
    onChange: (t: Tab) => void
}) {
    return (
        <nav
            role='tablist'
            aria-label='Settings sections'
            className='shrink-0 inline-flex items-center gap-3'
        >
            {TABS.map((t) => (
                <button
                    key={t.id}
                    type='button'
                    role='tab'
                    aria-selected={active === t.id}
                    onClick={() => onChange(t.id)}
                    title={t.label}
                    className={cn(
                        'transition-colors',
                        active === t.id
                            ? 'text-primary'
                            : 'text-muted hover:text-white'
                    )}
                >
                    <t.Icon className='size-4' />
                </button>
            ))}
        </nav>
    )
}

function SectionLabel({ children }: { children: ReactNode }) {
    return (
        <div className='flex items-center gap-2 pb-0.5'>
            <span className='text-[11px] font-semibold uppercase tracking-widest text-muted/80'>
                {children}
            </span>
            <div className='flex-1 h-px bg-white/10' />
        </div>
    )
}

function Card({ children }: { children: ReactNode }) {
    return (
        <div className='rounded-lg bg-white/3 ring-1 ring-white/8 px-3 py-2.5 space-y-3'>
            {children}
        </div>
    )
}

function RowSwitch({
    label,
    description,
    checked,
    onCheckedChange
}: {
    label: string
    description?: string
    checked: boolean
    onCheckedChange: (v: boolean) => void
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
                className='shrink-0'
            />
        </div>
    )
}

function SuffixInput({
    value,
    onChange,
    suffix,
    placeholder,
    error
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
                onChange={(e) => onChange(e.target.value)}
                className={cn(
                    'pr-14 bg-white/5 border-white/10',
                    error && 'border-rose-500/60'
                )}
            />
            <div className='absolute right-0 top-0 h-full px-3 flex items-center text-white text-xs font-semibold tracking-wide border-l border-white/10 bg-white/5 rounded-r-md'>
                {suffix}
            </div>
        </div>
    )
}

function FieldError({ message }: { message: string }) {
    return (
        <div className='flex items-start gap-2.5 rounded-lg px-3 py-2 bg-destructive/10 ring-1 ring-destructive/25'>
            <AlertCircle className='size-3.5 text-destructive shrink-0 mt-0.5' />
            <p className='text-[11px] text-destructive/90'>{message}</p>
        </div>
    )
}

function InfoNote({
    tone,
    children
}: {
    tone: InfoNoteTone
    children: ReactNode
}) {
    const t = INFO_NOTE_TONE[tone]
    return (
        <div className={cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 ring-1', t.bg, t.ring)}>
            <Info className={cn('size-3.5 shrink-0', t.icon)} />
            <p className={cn('text-[11px]', t.text)}>{children}</p>
        </div>
    )
}

function FiltersTab() {
    const { config, activeFilters, updatePresetFilters } = useTokenAnalyzer()
    const idx = config.activePresetIndex

    const [devMin, setDevMin] = useState(String(activeFilters.devHold.min))
    const [devMax, setDevMax] = useState(String(activeFilters.devHold.max))
    const [migration, setMigration] = useState(String(activeFilters.migration.pct))
    const [feesValue, setFeesValue] = useState(String(activeFilters.fees.minSol))
    const [fundingAmountMin, setFundingAmountMin] = useState(fmtNum(activeFilters.funding.amountMin))
    const [fundingAmountMax, setFundingAmountMax] = useState(fmtNum(activeFilters.funding.amountMax))
    const [fundingAgeMin, setFundingAgeMin] = useState(fmtNum(activeFilters.funding.ageMinHours))
    const [fundingAgeMax, setFundingAgeMax] = useState(fmtNum(activeFilters.funding.ageMaxHours))

    const [errors, setErrors] = useState<Errors>({})
    const skipAutoSave = useRef(true)

    useEffect(() => {
        skipAutoSave.current = true
        setDevMin(String(activeFilters.devHold.min))
        setDevMax(String(activeFilters.devHold.max))
        setMigration(String(activeFilters.migration.pct))
        setFeesValue(String(activeFilters.fees.minSol))
        setFundingAmountMin(fmtNum(activeFilters.funding.amountMin))
        setFundingAmountMax(fmtNum(activeFilters.funding.amountMax))
        setFundingAgeMin(fmtNum(activeFilters.funding.ageMinHours))
        setFundingAgeMax(fmtNum(activeFilters.funding.ageMaxHours))
        setErrors({})
    }, [idx])

    const patchToggle = (patch: Partial<Filters>) => updatePresetFilters(idx, patch)

    const autoSave = useDebouncedCallback(() => {
        const next: Errors = {}

        const dMin = parsePercent(devMin)
        const dMax = parsePercent(devMax)
        if (!dMin.ok) next.devMin = 'err'
        if (!dMax.ok) next.devMax = 'err'
        if (dMin.ok && dMax.ok && dMin.value > dMax.value) {
            next.devMin = 'err'
            next.devMax = 'err'
        }

        const mig = parsePercent(migration)
        let migValue = 5
        if (!mig.ok) {
            next.migrationPct = 'err'
        } else {
            migValue = Math.max(5, mig.value)
        }

        const fees = parseSol(feesValue)
        if (activeFilters.fees.enabled && !fees.ok) next.feesValue = 'err'

        const fAmtMin = parseOptionalNum(fundingAmountMin)
        const fAmtMax = parseOptionalNum(fundingAmountMax)
        const fAgeMin = parseOptionalNum(fundingAgeMin)
        const fAgeMax = parseOptionalNum(fundingAgeMax)
        if (!fAmtMin.ok) next.fundingAmountMin = 'err'
        if (!fAmtMax.ok) next.fundingAmountMax = 'err'
        if (!fAgeMin.ok) next.fundingAgeMin = 'err'
        if (!fAgeMax.ok) next.fundingAgeMax = 'err'

        setErrors(next)
        if (Object.keys(next).length > 0) return

        updatePresetFilters(idx, {
            devHold: {
                ...activeFilters.devHold,
                min: dMin.ok ? Math.max(0.1, dMin.value) : 0.1,
                max: dMax.ok ? dMax.value : 77
            },
            migration: {
                ...activeFilters.migration,
                pct: Math.min(100, migValue)
            },
            fees: {
                ...activeFilters.fees,
                minSol: fees.ok ? fees.value : 3
            },
            funding: {
                ...activeFilters.funding,
                amountMin: fAmtMin.ok ? fAmtMin.value : null,
                amountMax: fAmtMax.ok ? fAmtMax.value : null,
                ageMinHours: fAgeMin.ok ? fAgeMin.value : null,
                ageMaxHours: fAgeMax.ok ? fAgeMax.value : null
            }
        })
    }, 500)

    useEffect(() => {
        if (skipAutoSave.current) {
            skipAutoSave.current = false
            return
        }
        autoSave()
    }, [devMin, devMax, migration, feesValue, fundingAmountMin, fundingAmountMax, fundingAgeMin, fundingAgeMax, autoSave])

    const f = activeFilters

    return (
        <div className='space-y-4 py-2'>
            <SectionLabel>Dev Filters</SectionLabel>

            <Card>
                <RowSwitch
                    label='Dev Holdings'
                    description='Filter by developer token holding percentage'
                    checked={f.devHold.enabled}
                    onCheckedChange={(v) => patchToggle({ devHold: { ...f.devHold, enabled: v } })}
                />
                {f.devHold.enabled && (
                    <>
                        <Separator className='opacity-80' />
                        <div className='space-y-2'>
                            <Label className='text-xs text-muted'>Holdings %</Label>
                            <div className='grid grid-cols-2 gap-3'>
                                <SuffixInput value={devMin} onChange={setDevMin} suffix='MIN' placeholder='0.1' error={!!errors.devMin} />
                                <SuffixInput value={devMax} onChange={setDevMax} suffix='MAX' placeholder='77' error={!!errors.devMax} />
                            </div>
                        </div>
                    </>
                )}
            </Card>

            <Card>
                <RowSwitch
                    label='Migration'
                    description='Filter by dev migration success rate'
                    checked={f.migration.enabled}
                    onCheckedChange={(v) => patchToggle({ migration: { ...f.migration, enabled: v } })}
                />
                {f.migration.enabled && (
                    <>
                        <Separator className='opacity-80' />
                        <div className='space-y-2'>
                            <Label className='text-xs text-muted'>
                                Rate (% of migrated tokens from all dev tokens)
                            </Label>
                            <SuffixInput value={migration} onChange={setMigration} suffix='MIN' placeholder='30' error={!!errors.migrationPct} />
                            <InfoNote tone='sky'>
                                Minimum <span className='font-semibold text-white'>5%</span>
                            </InfoNote>
                        </div>
                        <Separator className='opacity-80' />
                        <RowSwitch
                            label='Last Token Migrated'
                            description='Require the most recent dev token to be migrated'
                            checked={f.migration.requireLastMigrated}
                            onCheckedChange={(v) => patchToggle({ migration: { ...f.migration, requireLastMigrated: v } })}
                        />
                    </>
                )}
            </Card>

            <Card>
                <RowSwitch
                    label='Funding Filter'
                    description='Filter by dev wallet funding amount and age'
                    checked={f.funding.enabled}
                    onCheckedChange={(v) => patchToggle({ funding: { ...f.funding, enabled: v } })}
                />
                {f.funding.enabled && (
                    <>
                        <Separator className='opacity-80' />
                        <div className='space-y-2'>
                            <Label className='text-xs text-muted'>Amount (SOL funded to dev wallet)</Label>
                            <div className='grid grid-cols-2 gap-3'>
                                <SuffixInput value={fundingAmountMin} onChange={setFundingAmountMin} suffix='MIN' placeholder='Any' error={!!errors.fundingAmountMin} />
                                <SuffixInput value={fundingAmountMax} onChange={setFundingAmountMax} suffix='MAX' placeholder='Any' error={!!errors.fundingAmountMax} />
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <Label className='text-xs text-muted'>Age (hours since funding tx)</Label>
                            <div className='grid grid-cols-2 gap-3'>
                                <SuffixInput value={fundingAgeMin} onChange={setFundingAgeMin} suffix='MIN' placeholder='Any' error={!!errors.fundingAgeMin} />
                                <SuffixInput value={fundingAgeMax} onChange={setFundingAgeMax} suffix='MAX' placeholder='Any' error={!!errors.fundingAgeMax} />
                            </div>
                        </div>
                    </>
                )}
            </Card>

            <SectionLabel>Token Filters</SectionLabel>

            <Card>
                <div className='flex items-center justify-between'>
                    <div>
                        <p className='text-sm font-medium text-white'>Protocols</p>
                        <p className='text-xs text-muted'>Show or hide tokens by launch protocol</p>
                    </div>
                </div>
                <div className='grid grid-cols-3 gap-2'>
                    {PROTOCOL_BUTTONS.map((p) => {
                        const setKey = PROTOCOL_FILTER_KEY[p.key]
                        const active = f[setKey]
                        return (
                            <button
                                key={p.key}
                                type='button'
                                onClick={() => patchToggle({ [setKey]: !active } as Partial<Filters>)}
                                className='flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all cursor-pointer'
                                style={{
                                    backgroundColor: `${p.color}15`,
                                    color: p.color,
                                    boxShadow: `inset 0 0 0 1px ${p.color}40`,
                                    opacity: active ? 1 : 0.35
                                }}
                            >
                                <img src={p.icon} alt={p.label} className='size-4' draggable={false} />
                                {p.label}
                            </button>
                        )
                    })}
                </div>
            </Card>

            <Card>
                <RowSwitch
                    label='Fees Filter'
                    description="Filter by dev's fee history on previous tokens"
                    checked={f.fees.enabled}
                    onCheckedChange={(v) => patchToggle({ fees: { ...f.fees, enabled: v } })}
                />
                {f.fees.enabled && (
                    <>
                        <Separator className='opacity-80' />
                        <div className='space-y-3'>
                            <div className='space-y-1.5'>
                                <Label className='text-xs text-muted'>Terminal</Label>
                                <SegmentedControl
                                    value={f.fees.source}
                                    options={FEES_TERMINALS.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
                                    onChange={(v) => patchToggle({ fees: { ...f.fees, source: v as FeesSource } })}
                                />
                                <InfoNote tone='rose'>
                                    Data source for token fee history analysis
                                </InfoNote>
                            </div>
                            <div className='space-y-1.5'>
                                <Label className='text-xs text-muted'>Calculation Mode</Label>
                                <SegmentedControl
                                    value={f.fees.mode}
                                    options={[
                                        { value: 'total',   label: 'Total' },
                                        { value: 'average', label: 'Average' },
                                        { value: 'each',    label: 'Each' }
                                    ]}
                                    onChange={(v) => patchToggle({ fees: { ...f.fees, mode: v as FeesMode } })}
                                />
                                <InfoNote tone='cyan'>
                                    {f.fees.mode === 'total'
                                        ? 'Sum of fees across all tracked tokens must exceed the threshold'
                                        : f.fees.mode === 'average'
                                        ? 'Average fee per token must exceed the threshold'
                                        : 'Each token must individually exceed the threshold'}
                                </InfoNote>
                            </div>
                            <div className='space-y-1.5'>
                                <Label className='text-xs text-muted'>Threshold</Label>
                                <SuffixInput value={feesValue} onChange={setFeesValue} suffix='SOL' placeholder='3' error={!!errors.feesValue} />
                            </div>
                        </div>
                    </>
                )}
            </Card>

            <Card>
                <RowSwitch
                    label='At least one social'
                    description='Require website, X, or Telegram link on the token'
                    checked={f.requireSocials}
                    onCheckedChange={(v) => patchToggle({ requireSocials: v })}
                />
            </Card>
        </div>
    )
}

// --- application tab ---

function AppTab() {
    const { config, setApp } = useTokenAnalyzer()
    const app = config.app

    return (
        <div className='space-y-4 py-2'>
            <div className='space-y-1.5'>
                <Label className='text-xs text-muted'>Terminal</Label>
                <TerminalPicker
                    value={app.terminal}
                    onChange={(t) => setApp({ terminal: t })}
                />
            </div>

            <Card>
                <RowSwitch
                    label='Auto-Open Token'
                    description='Automatically open matched tokens in the terminal'
                    checked={app.openInBrowser}
                    onCheckedChange={(v) => setApp({ openInBrowser: v })}
                />
                {app.openInBrowser && (
                    <>
                        <Separator className='opacity-80' />
                        <div className='flex items-center gap-2 rounded-md bg-amber-500/8 ring-1 ring-amber-500/15 px-2.5 py-1.5'>
                            <span className='text-amber-400 text-xs'>✨</span>
                            <p className='text-[11px] text-amber-300 flex-1'>
                                Requires <span className='font-semibold text-white'>Spark Opener</span> Extension
                            </p>
                            <a
                                href={SPARK_OPENER_STORE_URL}
                                onClick={(e) => {
                                    e.preventDefault()
                                    void openUrl(SPARK_OPENER_STORE_URL)
                                }}
                                className='text-[11px] text-sky-400 hover:text-sky-300 transition-colors font-medium'
                            >
                                Install Extension
                            </a>
                        </div>
                    </>
                )}
            </Card>

            <Card>
                <RowSwitch
                    label='Sound Notifications'
                    description='Play a sound when a new token passes filters'
                    checked={app.soundEnabled}
                    onCheckedChange={(v) => setApp({ soundEnabled: v })}
                />
                {app.soundEnabled && (
                    <>
                        <Separator className='opacity-80' />
                        <div className='space-y-1.5'>
                            <div className='flex items-center justify-between'>
                                <Label className='text-xs text-muted'>Volume</Label>
                                <span className='text-xs font-semibold text-white tabular-nums'>
                                    {app.soundVolume}%
                                </span>
                            </div>
                            <input
                                type='range'
                                min='0'
                                max='100'
                                step='5'
                                value={app.soundVolume}
                                onChange={(e) => setApp({ soundVolume: Number(e.target.value) }, true)}
                                className='w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer'
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
            </Card>

            <Card>
                <div className='flex items-center justify-between'>
                    <div>
                        <p className='text-sm font-medium text-white'>UI Scale</p>
                        <p className='text-xs text-muted'>Zoom the entire interface</p>
                    </div>
                    <span className='text-xs font-semibold text-white tabular-nums'>
                        {app.uiScale}%
                    </span>
                </div>
                <input
                    type='range'
                    min='75'
                    max='150'
                    step='5'
                    value={app.uiScale}
                    onChange={(e) => setApp({ uiScale: Number(e.target.value) }, true)}
                    className='w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer'
                />
                <div className='relative flex text-[11px] text-muted tabular-nums h-4'>
                    <span className='absolute left-0'>75%</span>
                    <span className='absolute left-1/3 -translate-x-1/2'>100%</span>
                    <span className='absolute left-2/3 -translate-x-1/2'>125%</span>
                    <span className='absolute right-0'>150%</span>
                </div>
            </Card>
        </div>
    )
}

// --- config tab (copy/paste JSON) ---

function ConfigTab() {
    const { config, replaceConfig } = useTokenAnalyzer()

    const [draft, setDraft] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
            toast.success('Config copied')
        } catch {
            toast.error('Could not copy')
        }
    }

    const handleImport = () => {
        const text = draft.trim()
        if (!text) {
            setError('Paste a config JSON first')
            return
        }
        let parsed: unknown
        try {
            parsed = JSON.parse(text)
        } catch {
            setError('Invalid JSON')
            return
        }
        const next = sanitizeImported(parsed)
        if (!next) {
            setError('Config shape is not recognised')
            return
        }
        replaceConfig(next)
        setDraft('')
        setError(null)
        toast.success('Config imported')
    }

    return (
        <div className='space-y-4 py-2'>
            <Card>
                <div className='flex items-center justify-between gap-3'>
                    <div className='min-w-0 space-y-0.5'>
                        <p className='text-sm font-medium text-white'>Export to clipboard</p>
                        <p className='text-xs text-muted'>Copy your config as JSON</p>
                    </div>
                    <Button
                        type='button'
                        onClick={handleCopy}
                        className='shrink-0'
                    >
                        <Copy data-icon='inline-start' />
                        Copy
                    </Button>
                </div>
            </Card>

            <Card>
                <div className='space-y-0.5'>
                    <p className='text-sm font-medium text-white'>Import from clipboard</p>
                    <p className='text-xs text-muted'>Paste an exported JSON to apply it</p>
                </div>
                <textarea
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setError(null) }}
                    placeholder='Paste config JSON here…'
                    rows={6}
                    spellCheck={false}
                    className={cn(
                        'w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder:text-muted/60 outline-none resize-none transition-colors scrollbar-hide focus:border-white/20',
                        error && 'border-rose-500/60 focus:border-rose-500/60'
                    )}
                />
                {error && <FieldError message={error} />}
                <Button
                    type='button'
                    onClick={handleImport}
                    disabled={!draft.trim()}
                    className='w-full'
                >
                    <ClipboardPaste data-icon='inline-start' />
                    Apply imported config
                </Button>
            </Card>
        </div>
    )
}

function sanitizeImported(raw: unknown): LiveFeedConfig | null {
    if (!raw || typeof raw !== 'object') return null
    const base = defaultConfig()
    const next = { ...base, ...(raw as Partial<LiveFeedConfig>), schema_version: SCHEMA_VERSION }
    if (!Array.isArray(next.presets) || next.presets.length !== base.presets.length) {
        next.presets = base.presets
    }
    if (typeof next.activePresetIndex !== 'number'
        || next.activePresetIndex < 0
        || next.activePresetIndex >= base.presets.length) {
        next.activePresetIndex = 0
    }
    next.app = normalizeApp(next.app)
    next.trackers = { ...base.trackers, ...(next.trackers ?? {}) }
    return next
}

// --- segmented control (text + optional icon) ---

function SegmentedControl({
    value,
    options,
    onChange
}: {
    value: string
    options: { value: string; label: string; icon?: string }[]
    onChange: (v: string) => void
}) {
    return (
        <div className='flex gap-1 p-0.5 rounded-md bg-white/5 ring-1 ring-white/8'>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type='button'
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1 text-xs font-medium cursor-pointer transition-colors',
                        value === opt.value
                            ? 'bg-white/10 text-white'
                            : 'text-muted hover:text-zinc-300'
                    )}
                >
                    {opt.icon && (
                        <img src={opt.icon} alt={opt.label} className='size-3.5' draggable={false} />
                    )}
                    {opt.label}
                </button>
            ))}
        </div>
    )
}

// --- terminal picker (3-card grid) ---

function TerminalPicker({
    value,
    onChange
}: {
    value: Terminal
    onChange: (t: Terminal) => void
}) {
    return (
        <div className='grid grid-cols-3 gap-2'>
            {TERMINALS.map((t) => (
                <button
                    key={t.id}
                    type='button'
                    onClick={() => onChange(t.id)}
                    className={cn(
                        'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md ring-1 transition-all duration-150 text-xs font-semibold cursor-pointer',
                        value === t.id
                            ? 'bg-white/8 ring-white/25 text-white'
                            : 'bg-white/3 ring-white/8 text-muted hover:bg-white/6 hover:text-zinc-200'
                    )}
                >
                    <img src={t.icon} alt={t.label} className='size-3.5 shrink-0' draggable={false} />
                    <span className='leading-none'>{t.label}</span>
                </button>
            ))}
        </div>
    )
}
