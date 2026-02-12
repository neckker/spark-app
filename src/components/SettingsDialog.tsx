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
import toast from 'react-hot-toast'

type FieldKey = 'devMin' | 'devMax' | 'migrationPct'
type Errors = Partial<Record<FieldKey, string>>

const normalize = (v: string) => v.trim().replace(',', '.')

const parsePercent = (raw: string) => {
    const cleaned = normalize(raw)
    if (!cleaned) return { ok: false as const, error: 'Required' }

    const n = Number(cleaned)
    if (!Number.isFinite(n)) {
        return { ok: false as const, error: 'Invalid number' }
    }

    return {
        ok: true as const,
        value: Math.max(0, Math.min(100, n))
    }
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
                onChange={e => onChange(e.target.value)}
                className={cn(
                    'pr-14 bg-white/5 border-white/10',
                    error && 'border-rose-500/60'
                )}
            />
            <div
                className={cn(
                    'absolute right-0 top-0 h-full px-3',
                    'flex items-center text-white',
                    'text-xs font-semibold tracking-wide',
                    'border-l border-white/10',
                    'bg-white/5'
                )}
            >
                {suffix}
            </div>
        </div>
    )
}

export default function SettingsDialog({
    children
}: {
    children: React.ReactNode
}) {
    const { settings, store, ready, patch } = useSettings()

    const [open, setOpen] = React.useState(false)
    const [busy, setBusy] = React.useState(false)

    // Локальные черновики полей — инициализируем из контекста при открытии
    const [devMin, setDevMin] = React.useState('')
    const [devMax, setDevMax] = React.useState('')
    const [migration, setMigration] = React.useState('')
    const [openInBrowser, setOpenInBrowser] = React.useState(false)
    const [errors, setErrors] = React.useState<Errors>({})

    const contentRef = React.useRef<HTMLDivElement | null>(null)

    // При открытии диалога синхронизируем черновики с актуальными настройками
    React.useEffect(() => {
        if (open) {
            setDevMin(String(settings.devMin))
            setDevMax(String(settings.devMax))
            setMigration(String(settings.migrationPct))
            setOpenInBrowser(settings.openInBrowser)
            setErrors({})
        }
    }, [open, settings])

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
                devMin: min.ok ? min.value : 0,
                devMax: max.ok ? max.value : 100,
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
            setOpen(false)
            toast.success('Settings saved')
        } catch {
            toast.error('Failed to save settings')
        } finally {
            setBusy(false)
        }
    }

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

                <div className='space-y-3'>
                    <div className='space-y-4'>
                        <div>
                            <div className='font-medium text-white'>
                                Filters
                            </div>
                            <div className='text-sm text-muted mt-0.5'>
                                Параметры фильтрации
                            </div>
                        </div>

                        {/* DEV HOLDINGS */}
                        <div className='space-y-2'>
                            <Label>Dev Holdings %</Label>

                            <div className='grid grid-cols-2 gap-3'>
                                <SuffixInput
                                    value={devMin}
                                    onChange={setDevMin}
                                    suffix='MIN'
                                    placeholder='0'
                                    error={!!errors.devMin}
                                />
                                <SuffixInput
                                    value={devMax}
                                    onChange={setDevMax}
                                    suffix='MAX'
                                    placeholder='100'
                                    error={!!errors.devMax}
                                />
                            </div>

                            {(errors.devMin || errors.devMax) && (
                                <div className='text-xs text-rose-300'>
                                    {errors.devMin || errors.devMax}
                                </div>
                            )}
                        </div>

                        {/* MIGRATION */}
                        <div className='space-y-2'>
                            <Label>Dev Migration %</Label>

                            <SuffixInput
                                value={migration}
                                onChange={setMigration}
                                suffix='FROM'
                                placeholder='3'
                                error={!!errors.migrationPct}
                            />

                            {errors.migrationPct && (
                                <div className='text-xs text-rose-300'>
                                    {errors.migrationPct}
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div className='flex items-center justify-between'>
                        <div>
                            <div className='font-medium text-white'>
                                Open token link in new tab
                            </div>
                            <div className='text-sm text-muted'>
                                Открывать axiom.trade в браузере
                            </div>
                        </div>
                        <Switch
                            checked={openInBrowser}
                            onCheckedChange={setOpenInBrowser}
                            disabled={busy}
                        />
                    </div>

                    <Separator />

                    <div className='flex justify-end'>
                        <Button
                            variant='default'
                            onClick={save}
                            disabled={busy}
                        >
                            {busy ? (
                                <span className='inline-flex items-center gap-2'>
                                    <Spinner className='h-4 w-4' />
                                    Saving…
                                </span>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
