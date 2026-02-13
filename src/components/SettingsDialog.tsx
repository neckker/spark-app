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
import { useSettings } from '@/context/SettingsContext'
import { Ban, Tag, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── types ────────────────────────────────────────────────────────────────────

type Tab = 'main' | 'labels' | 'blacklist'

type FieldKey = 'devMin' | 'devMax' | 'migrationPct'
type Errors = Partial<Record<FieldKey, string>>

// ─── helpers (unchanged from original) ───────────────────────────────────────

const normalize = (v: string) => v.trim().replace(',', '.')

const parsePercent = (raw: string) => {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: false as const, error: 'Required' }
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return { ok: false as const, error: 'Invalid number' }
    return { ok: true as const, value: Math.max(0, Math.min(100, n)) }
}

// ─── SuffixInput (unchanged from original) ───────────────────────────────────

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
                onChange={e => onChange(e.target.value)}
                className={cn(
                    'pr-14 bg-white/5 border-white/10',
                    error && 'border-rose-500/60'
                )}
            />
            <div className={cn(
                'absolute right-0 top-0 h-full px-3',
                'flex items-center text-white',
                'text-xs font-semibold tracking-wide',
                'border-l border-white/10',
                'bg-white/5'
            )}>
                {suffix}
            </div>
        </div>
    )
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
    const tabs: { id: Tab; label: string }[] = [
        { id: 'main',      label: 'Main' },
        { id: 'labels',    label: 'Labels' },
        { id: 'blacklist', label: 'Blacklist' },
    ]
    return (
        <div className='flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8'>
            {tabs.map(t => (
                <button
                    key={t.id}
                    type='button'
                    onClick={() => onChange(t.id)}
                    className={cn(
                        'flex-1 rounded-md px-3 py-1.5',
                        'text-xs font-medium transition-colors',
                        active === t.id
                            ? 'bg-white/10 text-white'
                            : 'text-muted hover:text-zinc-300'
                    )}
                >
                    {t.label}
                </button>
            ))}
        </div>
    )
}

// ─── MainTab (содержимое оригинального диалога без изменений) ─────────────────

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

    const [devMin,        setDevMin]        = React.useState(String(settings.devMin))
    const [devMax,        setDevMax]        = React.useState(String(settings.devMax))
    const [migration,     setMigration]     = React.useState(String(settings.migrationPct))
    const [openInBrowser, setOpenInBrowser] = React.useState(settings.openInBrowser)
    const [errors,        setErrors]        = React.useState<Errors>({})

    // Re-sync when dialog re-opens (parent passes fresh settings)
    React.useEffect(() => {
        setDevMin(String(settings.devMin))
        setDevMax(String(settings.devMax))
        setMigration(String(settings.migrationPct))
        setOpenInBrowser(settings.openInBrowser)
        setErrors({})
    }, [settings])

    const validate = () => {
        const next: Errors = {}
        const min = parsePercent(devMin)
        const max = parsePercent(devMax)
        const mig = parsePercent(migration)

        if (!min.ok) next.devMin = min.error
        if (!max.ok) next.devMax = max.error
        if (!mig.ok) next.migrationPct = mig.error

        if (min.ok && max.ok && min.value > max.value) {
            next.devMin = 'Min > Max'
            next.devMax = 'Max < Min'
        }
        setErrors(next)
        return {
            ok: Object.keys(next).length === 0,
            values: {
                devMin:       min.ok ? min.value : 0,
                devMax:       max.ok ? max.value : 100,
                migrationPct: mig.ok ? mig.value : 0,
                openInBrowser
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
        <div className='space-y-3'>
            <div className='space-y-4'>
                <div>
                    <div className='font-medium text-white'>Filters</div>
                    <div className='text-sm text-muted mt-0.5'>Параметры фильтрации</div>
                </div>

                {/* DEV HOLDINGS */}
                <div className='space-y-2'>
                    <Label>Dev Holdings %</Label>
                    <div className='grid grid-cols-2 gap-3'>
                        <SuffixInput value={devMin} onChange={setDevMin} suffix='MIN' placeholder='0'   error={!!errors.devMin} />
                        <SuffixInput value={devMax} onChange={setDevMax} suffix='MAX' placeholder='100' error={!!errors.devMax} />
                    </div>
                    {(errors.devMin || errors.devMax) && (
                        <div className='text-xs text-rose-300'>{errors.devMin || errors.devMax}</div>
                    )}
                </div>

                {/* MIGRATION */}
                <div className='space-y-2'>
                    <Label>Dev Migration %</Label>
                    <SuffixInput value={migration} onChange={setMigration} suffix='FROM' placeholder='3' error={!!errors.migrationPct} />
                    {errors.migrationPct && (
                        <div className='text-xs text-rose-300'>{errors.migrationPct}</div>
                    )}
                </div>
            </div>

            <Separator />

            <div className='flex items-center justify-between'>
                <div>
                    <div className='font-medium text-white'>Open token link in new tab</div>
                    <div className='text-sm text-muted'>Открывать axiom.trade в браузере</div>
                </div>
                <Switch checked={openInBrowser} onCheckedChange={setOpenInBrowser} disabled={busy} />
            </div>

            <Separator />

            <div className='flex justify-end'>
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
        <div className='space-y-1.5'>
            {entries.map(([addr, label]) => (
                <div
                    key={addr}
                    className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'
                >
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
        <div className='space-y-1.5'>
            {entries.map(addr => {
                const label = walletLabels[addr]
                return (
                    <div
                        key={addr}
                        className='flex items-center gap-2 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8'
                    >
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

// ─── SettingsDialog ───────────────────────────────────────────────────────────

export default function SettingsDialog({ children }: { children: React.ReactNode }) {
    const { settings, store, ready } = useSettings()

    const [open,    setOpen]    = React.useState(false)
    const [busy,    setBusy]    = React.useState(false)
    const [tab,     setTab]     = React.useState<Tab>('main')

    const contentRef = React.useRef<HTMLDivElement | null>(null)

    // Сбрасываем вкладку при открытии
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
                className='sm:max-w-115'
                onOpenAutoFocus={e => {
                    e.preventDefault()
                    requestAnimationFrame(() => contentRef.current?.focus())
                }}
            >
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>Настройки приложения</DialogDescription>
                </DialogHeader>

                {/* Вкладки */}
                <TabBar active={tab} onChange={setTab} />

                {/* Контент */}
                {tab === 'main' && (
                    <MainTab
                        settings={settings}
                        store={store}
                        busy={busy}
                        setBusy={setBusy}
                        onSaved={() => setOpen(false)}
                    />
                )}
                {tab === 'labels'    && <LabelsTab />}
                {tab === 'blacklist' && <BlacklistTab />}
            </DialogContent>
        </Dialog>
    )
}
