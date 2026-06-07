import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
    AlertCircle,
    ArrowLeft,
    Bookmark,
    Check,
    Copy,
    Info,
    Plus,
    ShieldCheck,
    ShieldX,
    Trash2,
    Users,
    X,
    type LucideIcon
} from 'lucide-react'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTokenAnalyzer } from '@/context/TokenAnalyzerContext'
import { cn } from '@/lib/utils'
import { formatAge, shortAddress } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'

const SOLANA_WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const LABEL_RE = /^[a-z0-9_-]{4,16}$/

type TrackerRow = {
    address: string
    label: string | null
    isWhitelisted: boolean
    isBlacklisted: boolean
    createdAt: number
}

export function Trackers({ onBack }: { onBack?: () => void }) {
    const { config, upsertTracker, removeTracker } = useTokenAnalyzer()

    const [search, setSearch] = useState('')
    const [addOpen, setAddOpen] = useState(false)

    const rows = useMemo<TrackerRow[]>(() => {
        return Object.values(config.trackers)
            .map((t) => ({
                address: t.address,
                label: t.label,
                isWhitelisted: t.list === 'whitelist',
                isBlacklisted: t.list === 'blacklist',
                createdAt: t.createdAt
            }))
            .sort((a, b) => {
                if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
                return a.address.localeCompare(b.address)
            })
    }, [config.trackers])

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((r) =>
            r.address.toLowerCase().includes(q)
            || (r.label?.toLowerCase().includes(q) ?? false)
        )
    }, [rows, search])

    useSecondTicker(rows)

    const toggleList = (row: TrackerRow, next: 'whitelist' | 'blacklist') => {
        const currentlyOn =
            (next === 'whitelist' && row.isWhitelisted)
            || (next === 'blacklist' && row.isBlacklisted)
        if (currentlyOn) {
            if (!row.label) {
                removeTracker(row.address)
            } else {
                upsertTracker(row.address, { list: null })
            }
        } else {
            upsertTracker(row.address, { list: next })
        }
    }

    const removeAll = (addr: string) => {
        removeTracker(addr)
        toast.success('Removed')
    }

    return (
        <div className='space-y-4'>
            <header className='flex items-center gap-3'>
                {onBack && (
                    <button
                        type='button'
                        onClick={onBack}
                        className='inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-white transition-colors cursor-pointer'
                    >
                        <ArrowLeft className='size-4' />
                        Back to Feed
                    </button>
                )}
                <Button
                    size='sm'
                    onClick={() => setAddOpen(true)}
                    className='ml-auto shrink-0'
                >
                    <Plus className='size-4' />
                    Add Wallet
                </Button>
            </header>

            {rows.length > 0 && (
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Search by name or address…'
                    className='bg-white/5 border-white/10 text-sm'
                />
            )}

            {rows.length === 0 ? (
                <EmptyState
                    icon={<Users className='size-5' />}
                    title='No tracked wallets yet'
                    body='Whitelist trusted devs, blacklist the rest'
                />
            ) : visible.length === 0 ? (
                <div className='rounded-lg bg-white/3 ring-1 ring-white/8 py-12 text-center text-sm text-muted'>
                    No matches
                </div>
            ) : (
                <ul className='space-y-1.5'>
                    {visible.map((row) => (
                        <li key={row.address.toLowerCase()}>
                            <TrackerCard
                                row={row}
                                onRename={(label) => upsertTracker(row.address, { label: label || null })}
                                onToggleWhitelist={() => toggleList(row, 'whitelist')}
                                onToggleBlacklist={() => toggleList(row, 'blacklist')}
                                onRemove={() => removeAll(row.address)}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <AddWalletDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                existing={useMemo(
                    () => new Set(Object.keys(config.trackers)),
                    [config.trackers]
                )}
                onAdd={(addr, label, target) => {
                    upsertTracker(addr, {
                        label,
                        list: target === 'none' ? null : target
                    })
                    toast.success('Wallet added')
                    setAddOpen(false)
                }}
            />
        </div>
    )
}

function TrackerCard({
    row,
    onRename,
    onToggleWhitelist,
    onToggleBlacklist,
    onRemove
}: {
    row: TrackerRow
    onRename: (label: string) => void
    onToggleWhitelist: () => void
    onToggleBlacklist: () => void
    onRemove: () => void
}) {
    const [copied, setCopied] = useState(false)

    const copy = async (e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await navigator.clipboard.writeText(row.address)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            toast.error('Could not copy')
        }
    }

    return (
        <div className='group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/3 transition-colors'>
            <div className='shrink-0 w-10 text-xs text-muted tabular-nums'>
                {formatAge(row.createdAt)}
            </div>

            <div className='flex-1 min-w-0 flex items-center gap-2'>
                <InlineName value={row.label ?? ''} onCommit={onRename} />
                <AddressChip address={row.address} copied={copied} onCopy={copy} />
            </div>

            <div className='inline-flex items-center gap-1 shrink-0'>
                <ListBtn
                    Icon={ShieldCheck}
                    label={row.isWhitelisted ? 'Remove from whitelist' : 'Add to whitelist'}
                    active={row.isWhitelisted}
                    tone='emerald'
                    onClick={onToggleWhitelist}
                />
                <ListBtn
                    Icon={ShieldX}
                    label={row.isBlacklisted ? 'Remove from blacklist' : 'Add to blacklist'}
                    active={row.isBlacklisted}
                    tone='rose'
                    onClick={onToggleBlacklist}
                />
            </div>

            <button
                type='button'
                onClick={onRemove}
                title='Remove tracker'
                className='shrink-0 size-7 rounded-md grid place-items-center text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 cursor-pointer'
            >
                <Trash2 className='size-3.5' />
            </button>
        </div>
    )
}

function InlineName({
    value,
    onCommit
}: {
    value: string
    onCommit: (next: string) => void
}) {
    const [draft, setDraft] = useState(value)

    if (draft !== value && document.activeElement?.tagName !== 'INPUT') {
        setDraft(value)
    }

    const commit = () => {
        const trimmed = draft.trim().slice(0, 16)
        if (trimmed !== value) onCommit(trimmed)
    }

    return (
        <span
            className={cn(
                'inline-grid grid-cols-1 grid-rows-1 h-6 max-w-[16ch] leading-none cursor-text',
                'border-b border-transparent hover:border-white/15 focus-within:border-primary/60',
                'transition-colors'
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'col-start-1 row-start-1 invisible whitespace-pre text-sm leading-none',
                    draft
                        ? 'font-semibold not-italic'
                        : 'font-normal italic'
                )}
            >
                {draft || 'unknown'}
            </span>
            <input
                type='text'
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') { setDraft(value); e.currentTarget.blur() }
                }}
                maxLength={16}
                placeholder='unknown'
                spellCheck={false}
                size={1}
                className={cn(
                    'col-start-1 row-start-1 w-full min-w-0 bg-transparent outline-none border-0 p-0 text-sm leading-none',
                    'text-white font-semibold not-italic',
                    'placeholder:text-muted placeholder:font-normal placeholder:italic'
                )}
            />
        </span>
    )
}

function AddressChip({
    address,
    copied,
    onCopy
}: {
    address: string
    copied: boolean
    onCopy: (e: React.MouseEvent) => void
}) {
    return (
        <button
            type='button'
            onClick={onCopy}
            title={`Copy ${address}`}
            aria-label='Copy address'
            className='group/addr inline-flex items-center gap-1.5 px-1.5 -mx-1.5 rounded font-mono text-[11px] text-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer'
        >
            <span>{shortAddress(address, 6, 4)}</span>
            {copied
                ? <Check className='size-3 text-emerald-400' />
                : <Copy className='size-3 opacity-0 group-hover/addr:opacity-70 transition-opacity' />}
        </button>
    )
}

function ListBtn({
    Icon,
    label,
    active,
    tone,
    onClick
}: {
    Icon: LucideIcon
    label: string
    active: boolean
    tone: 'emerald' | 'rose'
    onClick: () => void
}) {
    const ACTIVE: Record<'emerald' | 'rose', string> = {
        emerald: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
        rose:    'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
    }
    const HOVER: Record<'emerald' | 'rose', string> = {
        emerald: 'hover:text-emerald-300 hover:bg-emerald-500/10',
        rose:    'hover:text-rose-300 hover:bg-rose-500/10'
    }
    return (
        <button
            type='button'
            onClick={onClick}
            title={label}
            aria-label={label}
            className={cn(
                'size-7 rounded-md grid place-items-center transition-all duration-200 cursor-pointer',
                active ? ACTIVE[tone] : `text-muted ${HOVER[tone]}`
            )}
        >
            <Icon className='size-3.5' />
        </button>
    )
}

// --- add wallet dialog ---

type InitialList = 'none' | 'whitelist' | 'blacklist'

const INITIAL_LIST_OPTIONS: {
    id: InitialList
    label: string
    Icon: LucideIcon
    tone: 'neutral' | 'emerald' | 'rose'
}[] = [
    { id: 'none',      label: 'Track only', Icon: Bookmark,    tone: 'neutral' },
    { id: 'whitelist', label: 'Whitelist',  Icon: ShieldCheck, tone: 'emerald' },
    { id: 'blacklist', label: 'Blacklist',  Icon: ShieldX,     tone: 'rose' }
]

function AddWalletDialog({
    open,
    onClose,
    onAdd,
    existing
}: {
    open: boolean
    onClose: () => void
    onAdd: (
        address: string,
        label: string | null,
        target: InitialList
    ) => void
    existing: Set<string>
}) {
    const [address, setAddress] = useState('')
    const [label, setLabel] = useState('')
    const [target, setTarget] = useState<InitialList>('none')

    const resetAndClose = () => {
        setAddress(''); setLabel(''); setTarget('none')
        onClose()
    }

    const addrClean = address.trim()
    const labelClean = label.trim()

    const addrValid = SOLANA_WALLET_RE.test(addrClean)
    const alreadyTracked = addrValid && existing.has(addrClean.toLowerCase())
    const labelValid = labelClean === '' || LABEL_RE.test(labelClean)

    const canAdd = addrValid && !alreadyTracked && labelValid

    const submit = () => {
        if (!canAdd) return
        onAdd(addrClean, labelClean || null, target)
        setAddress(''); setLabel(''); setTarget('none')
    }

    const walletInvalid = addrClean !== '' && (!addrValid || alreadyTracked)
    const walletHint = alreadyTracked
        ? 'This wallet is already tracked'
        : 'The full Solana wallet address you want to track (32-44 characters)'
    const labelInvalid = labelClean !== '' && !labelValid

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose() }}>
            <DialogContent>
                <div className='flex items-center gap-3'>
                    <div className='flex-1 min-w-0'>
                        <DialogTitle>Add wallet</DialogTitle>
                        <DialogDescription className='mt-1'>
                            Track a dev wallet, optionally with a label
                        </DialogDescription>
                    </div>
                </div>

                <div className='space-y-3'>
                    <div>
                        <div className='space-y-1.5'>
                            <Label className='text-xs font-medium text-white'>
                                Wallet
                            </Label>
                            <Input
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder='Solana wallet address'
                                aria-invalid={walletInvalid}
                                className='text-sm bg-field border-white/10'
                            />
                        </div>
                        <FieldHint text={walletHint} invalid={walletInvalid} />
                    </div>

                    <div>
                        <div className='space-y-1.5'>
                            <Label className='text-xs font-medium text-white'>
                                Label (optional)
                            </Label>
                            <Input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                                placeholder='e.g. mayhem_bot'
                                maxLength={16}
                                aria-invalid={labelInvalid}
                                className='text-sm bg-field border-white/10'
                            />
                        </div>
                        <FieldHint
                            text='4-16 characters: lowercase letters, digits, - and _'
                            invalid={labelInvalid}
                        />
                    </div>

                    <div className='space-y-1.5'>
                        <Label className='text-xs font-medium text-white'>
                            Initial list
                        </Label>
                        <div className='grid grid-cols-3 gap-2'>
                            {INITIAL_LIST_OPTIONS.map((opt) => (
                                <InitialListCard
                                    key={opt.id}
                                    option={opt}
                                    active={target === opt.id}
                                    onClick={() => setTarget(opt.id)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className='flex items-center gap-2 pt-1'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={resetAndClose}
                        className='flex-1'
                    >
                        <X className='size-4' />
                        Cancel
                    </Button>
                    <Button
                        size='sm'
                        onClick={submit}
                        disabled={!canAdd}
                        className='flex-1'
                    >
                        <Plus className='size-4' />
                        Add wallet
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function FieldHint({
    text,
    invalid
}: {
    text: string
    invalid: boolean
}) {
    return (
        <div
            className={cn(
                'mt-2.5 flex items-center gap-1.5 text-[11px] leading-snug',
                invalid ? 'text-destructive/90' : 'text-muted'
            )}
        >
            {invalid ? (
                <AlertCircle className='size-3.5 shrink-0' />
            ) : (
                <Info className='size-3.5 shrink-0' />
            )}
            <span>{text}</span>
        </div>
    )
}

// --- initial-list card (compact pill: icon left + label) ---

function InitialListCard({
    option,
    active,
    onClick
}: {
    option: (typeof INITIAL_LIST_OPTIONS)[number]
    active: boolean
    onClick: () => void
}) {
    const TONE_ACTIVE: Record<typeof option.tone, string> = {
        neutral: 'bg-white/8 ring-white/25 text-white',
        emerald: 'bg-emerald-500/12 ring-emerald-500/35 text-emerald-200',
        rose:    'bg-rose-500/12 ring-rose-500/35 text-rose-200'
    }
    const TONE_IDLE_ICON: Record<typeof option.tone, string> = {
        neutral: 'text-white/40',
        emerald: 'text-emerald-400/50',
        rose:    'text-rose-400/50'
    }
    return (
        <button
            type='button'
            onClick={onClick}
            className={cn(
                'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md ring-1 transition-all duration-150 text-xs font-semibold cursor-pointer',
                active
                    ? TONE_ACTIVE[option.tone]
                    : 'bg-white/3 ring-white/8 text-muted hover:bg-white/6 hover:text-zinc-200'
            )}
        >
            <option.Icon className={cn('size-3.5 shrink-0 transition-colors', active ? '' : TONE_IDLE_ICON[option.tone])} />
            <span className='leading-none'>{option.label}</span>
        </button>
    )
}

// --- live ticker ---

const YOUNG_WINDOW_MS = 60_000

function hasYoungTracker(rows: TrackerRow[]): boolean {
    const now = Date.now()
    return rows.some((r) => now - r.createdAt < YOUNG_WINDOW_MS)
}

function useSecondTicker(rows: TrackerRow[]): void {
    const [, force] = useState(0)
    const hasYoung = hasYoungTracker(rows)

    useEffect(() => {
        if (!hasYoung) return
        const id = window.setInterval(() => force((n) => n + 1), 1000)
        return () => window.clearInterval(id)
    }, [hasYoung])
}
