import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

import { AXIOM_URL } from '@/lib/axiom'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import pumpIcon   from '@/assets/pump.svg'
import mayhemIcon from '@/assets/mayhem.svg'
import bonkIcon   from '@/assets/bonk.svg'
import axiomIcon  from '@/assets/axiom.svg'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    CheckCircle2, CircleDashed, Search,
    Globe, Send, TriangleAlert, Twitter,
    ChefHat, Coins, GitMerge, Percent,
    BadgeDollarSign, ChartNoAxesCombined, HandCoins,
    Tag, Ban, Clock
} from 'lucide-react'

import type { TokenCardModel, LastMigratedToken } from '@/hooks/useSparkTokens'
import { useSettings } from '@/context/SettingsContext'

// ─── helpers ─────────────────────────────────────────────────────────────────

function safeUrl(u: string) {
    try { return new URL(u).toString() } catch { return '' }
}

function fmtUsdCap(usd: number): string {
    if (!Number.isFinite(usd) || usd <= 0) return '—'
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
    if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(1)}k`
    return `$${usd.toFixed(0)}`
}

function fmtSol(sol: number | null): string {
    if (sol === null || !Number.isFinite(sol)) return '—'
    return sol.toFixed(2)
}

/** date-fns без суффикса "ago" */
function fmtAgo(tsMs: number): string {
    if (!tsMs) return ''
    try {
        return formatDistanceToNow(new Date(tsMs), { addSuffix: false })
    } catch {
        return ''
    }
}

// ─── constants ───────────────────────────────────────────────────────────────

const PROTOCOLS: Record<
    string,
    { href: (address: string) => string; icon: string; title: string }
> = {
    pump: {
        href: address => `https://pump.fun/coin/${address}`,
        icon: pumpIcon,
        title: 'pump.fun'
    },
    bonk: {
        href: address => `https://bonk.fun/token/${address}`,
        icon: bonkIcon,
        title: 'bonk.fun'
    }
}

// ─── LabelModal ──────────────────────────────────────────────────────────────

function LabelModal({
    open,
    onClose,
    address,
    currentLabel,
}: {
    open: boolean
    onClose: () => void
    address: string
    currentLabel: string
}) {
    const { setWalletLabel } = useSettings()
    const [value, setValue] = useState(currentLabel)

    const commit = async () => {
        const trimmed = value.trim()
        if (!trimmed) return
        await setWalletLabel(address, trimmed)
        toast.success(`Label saved: ${trimmed.slice(0, 10)}`)
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className='sm:max-w-xs'>
                <DialogHeader>
                    <DialogTitle>Label wallet</DialogTitle>
                    <DialogDescription className='font-mono text-xs break-all'>
                        {address}
                    </DialogDescription>
                </DialogHeader>
                <div className='space-y-3'>
                    <Input
                        autoFocus
                        value={value}
                        maxLength={10}
                        placeholder='Up to 10 characters'
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); void commit() }
                            if (e.key === 'Escape') { e.preventDefault(); onClose() }
                        }}
                        className='bg-white/5 border-white/10'
                    />
                    <div className='flex justify-end gap-2'>
                        <Button variant='ghost' onClick={onClose}>Cancel</Button>
                        <Button onClick={() => void commit()} disabled={!value.trim()}>Save</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── MigratedTokenCard ───────────────────────────────────────────────────────

function MigratedTokenCard({
    t,
    solPrice
}: {
    t: LastMigratedToken
    solPrice: number | null
}) {
    const mcUsd   = solPrice && t.market_cap > 0 ? t.market_cap * solPrice : null
    const agoText = t.created_at ? fmtAgo(t.created_at) : ''

    const dexCls =
        t.is_dex_paid === true  ? 'text-emerald-400' :
        t.is_dex_paid === false ? 'text-red-400' :
                                  'text-zinc-600'

    return (
        <a
            href={AXIOM_URL(t.address)}
            target='_blank'
            rel='noreferrer'
            className={[
                'flex items-center gap-2.5',
                'rounded-lg px-2.5 py-2',
                'bg-white/3 ring-1 ring-white/8',
                'hover:bg-white/6 transition-colors',
                'min-w-0'
            ].join(' ')}
        >
            {/* image */}
            <Avatar className='h-8 w-8 rounded-lg'>
                <AvatarImage src={t.image} className='rounded-lg object-cover' />
                <AvatarFallback className='rounded-lg bg-white/5 text-xs'>
                    {t.ticker.slice(0, 2) || '??'}
                </AvatarFallback>
            </Avatar>

            <div className='min-w-0 flex-1'>
                {/* ticker + name */}
                <div className='flex items-baseline gap-1.5 truncate'>
                    <span className='text-sm font-semibold text-zinc-100'>
                        {t.ticker.toUpperCase()}
                    </span>
                    <span className='text-sm font-normal text-muted hover:text-muted/80 transition-colors truncate'>
                        {t.name}
                    </span>
                </div>

                {/* date + mcap + fees + dex */}
                <div className='flex items-center space-x-2 mt-1 flex-wrap'>
                    {agoText && (
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            <Clock className='size-3.5' />
                            <span className='tabular-nums text-indigo-400 font-medium'>{agoText}</span>
                        </span>
                    )}

                    {mcUsd !== null && (
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            {/* <span className='text-muted'>MC</span> */}
                            <ChartNoAxesCombined className='size-4' />
                            <span className='tabular-nums text-emerald-300 font-medium'>{fmtUsdCap(mcUsd)}</span>
                        </span>
                    )}

                    {t.total_fees !== null && (
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            <HandCoins className='size-4' />
                            <span className='tabular-nums text-violet-400 font-medium'>{fmtSol(t.total_fees)} SOL</span>
                        </span>
                    )}

                    {t.is_dex_paid !== null && (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${dexCls}`}>
                            <BadgeDollarSign className='h-4 w-4' />
                            DEX
                        </span>
                    )}
                </div>
            </div>
        </a>
    )
}

// ─── TokenRow ────────────────────────────────────────────────────────────────

export function TokenRow({
    item,
    solPriceUsd
}: {
    item: TokenCardModel
    solPriceUsd: number | null
}) {
    const { token, dev, lastMigrated, metadata, metaStatus } = item
    const { walletLabels, addToBlacklist } = useSettings()

    const [labelModalOpen, setLabelModalOpen] = useState(false)

    const devLabel  = walletLabels[dev.address]
    const rawTicker = metadata?.ticker || token.ticker || ''
    const ticker    = rawTicker.trim() ? rawTicker.toUpperCase() : 'NA'
    const name      = metadata?.name || token.name
    const avatarUrl = metadata?.image_url ? safeUrl(metadata.image_url) : ''

    const links = useMemo(() => ({
        website:  metadata?.website  ? safeUrl(metadata.website)  : '',
        twitter:  metadata?.twitter  ? safeUrl(metadata.twitter)  : '',
        telegram: metadata?.telegram ? safeUrl(metadata.telegram) : '',
    }), [metadata?.website, metadata?.twitter, metadata?.telegram])

    const protocol   = token.protocol
    const proto      = protocol ? PROTOCOLS[protocol] : null
    const isMayhem   = token.is_mayhem_mode === true
    const protoIcon  = protocol === 'pump' && isMayhem ? mayhemIcon : proto?.icon
    const protoTitle = protocol === 'pump' && isMayhem ? 'pump.fun (mayhem)' : proto?.title

    const onCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(token.address)
            toast.success('Address successfully copied', { icon: '📋' })
        } catch {
            toast.error('Failed to copy address')
        }
    }

    const onBlacklist = async () => {
        await addToBlacklist(dev.address)
        toast.success('Dev wallet blacklisted')
    }

    const MetaIcon =
        metaStatus === 'loading' ? CircleDashed :
        metaStatus === 'ready'   ? CheckCircle2 :
        metaStatus === 'error'   ? TriangleAlert : null

    const metaCls =
        metaStatus === 'loading' ? 'text-zinc-400' :
        metaStatus === 'ready'   ? 'text-emerald-300' :
        metaStatus === 'error'   ? 'text-red-300' : 'text-zinc-400'

    const iconLinkCls = 'hover:text-zinc-200 transition-colors'

    // rate: < 5% красный, 5–25% жёлтый, > 25% зелёный
    const rateCls =
        dev.tokens.rate >= 25 ? 'text-emerald-400' :
        dev.tokens.rate >= 5  ? 'text-amber-300'   :
                                'text-red-400'

    return (
        <div className='rounded-xl px-3 py-2.5 bg-panel ring-1 ring-line space-y-2.5'>

            {/* ── token info ── */}
            <div className='flex items-start gap-3'>
                <div className='relative group shrink-0'>
                    <Avatar className='h-10 w-10 rounded-lg'>
                        <AvatarImage src={avatarUrl} className='rounded-lg object-cover' />
                        <AvatarFallback className='rounded-lg bg-white/5 text-xs'>
                            {ticker.slice(0, 2) || '??'}
                        </AvatarFallback>
                    </Avatar>

                    {avatarUrl && (
                        <div className={[
                            'pointer-events-none absolute left-0 top-0 z-50',
                            'opacity-0 scale-95',
                            'group-hover:opacity-100 group-hover:scale-100',
                            'transition duration-150 ease-out',
                            '-translate-y-1 -translate-x-1 origin-top-left'
                        ].join(' ')}>
                            <div className='h-40 w-40 rounded-xl overflow-hidden ring-1 ring-white/15 bg-zinc-950/60 backdrop-blur'>
                                <img src={avatarUrl} alt={ticker} className='h-full w-full object-cover' draggable={false} />
                            </div>
                        </div>
                    )}
                </div>

                <div className='min-w-0 flex-1'>
                    <div className='min-w-0 flex-1 truncate text-sm font-semibold'>
                        {ticker}{' '}
                        <button
                            type='button'
                            onClick={onCopyAddress}
                            className='font-normal text-muted hover:text-muted/80 transition-colors cursor-pointer'
                            title='Click to copy address'
                        >
                            {name}
                        </button>
                    </div>

                    <div className='mt-1 flex items-center gap-2 text-zinc-400'>
                        {proto && (
                            <a href={proto.href(token.address)} target='_blank' rel='noreferrer'
                               title={protoTitle} className='hover:opacity-80 transition-opacity'>
                                <img src={protoIcon} alt={protoTitle} className='h-4 w-4' draggable={false} />
                            </a>
                        )}

                        <a href={AXIOM_URL(token.address)} target='_blank' rel='noreferrer'
                           title='View on Axiom' className='hover:opacity-80 transition-opacity'>
                            <img src={axiomIcon} alt='Axiom' className='h-4 w-4' draggable={false} />
                        </a>

                        {links.twitter && (
                            <a href={links.twitter} target='_blank' rel='noreferrer'
                               className='text-[#5dbcff] hover:text-[#5dbcff]/80 transition-colors' title={links.twitter}>
                                <Twitter className='h-4 w-4' />
                            </a>
                        )}
                        {links.website && (
                            <a href={links.website} target='_blank' rel='noreferrer'
                               className={iconLinkCls} title={links.website}>
                                <Globe className='h-4 w-4' />
                            </a>
                        )}
                        {links.telegram && (
                            <a href={links.telegram} target='_blank' rel='noreferrer'
                               className={iconLinkCls} title={links.telegram}>
                                <Send className='h-4 w-4' />
                            </a>
                        )}

                        <a href={`https://x.com/search?q=${token.address}&src=typed_query&f=live`}
                           target='_blank' rel='noreferrer' className={iconLinkCls}>
                            <Search className='h-4 w-4' />
                        </a>

                        {MetaIcon && (
                            <MetaIcon className={[
                                'h-4 w-4',
                                metaStatus === 'loading' ? 'animate-spin' : '',
                                metaCls
                            ].join(' ')} />
                        )}

                        {/* devhold — в той же строке */}
                        <Badge variant='secondary' className={[
                            'ml-1 h-5 px-2',
                            'text-[11px] tabular-nums',
                            'bg-zinc-900/70 text-zinc-200',
                            'ring-1 ring-white/10'
                        ].join(' ')} title='Dev hold'>
                            DEV {token.devhold}%
                        </Badge>
                    </div>
                </div>
            </div>

            {/* ── dev stats ── */}
            <Separator className='opacity-50' />

            <div className='flex items-center gap-3 text-xs flex-wrap'>
                {/* заголовок: иконка + label если есть, иначе "Dev" */}
                <span className='inline-flex items-center gap-1 text-muted text-xs font-medium uppercase tracking-wide'>
                    <ChefHat className='h-3.5 w-3.5' />
                    {devLabel
                        ? <span className='text-sky-300 uppercase'>{devLabel}</span>
                        : 'Dev'
                    }
                </span>

                <span className='inline-flex items-center gap-1' title='Total tokens created'>
                    <Coins className='h-3.5 w-3.5 text-muted' />
                    <span className='tabular-nums text-white font-medium'>{dev.tokens.total}</span>
                    <span className='text-muted font-mono'>tokens</span>
                </span>

                <span className='inline-flex items-center gap-1' title='Migrated tokens'>
                    <GitMerge className='h-3.5 w-3.5 text-muted' />
                    <span className='tabular-nums text-white font-medium'>{dev.tokens.migrated}</span>
                    <span className='text-muted font-mono'>migrated</span>
                </span>

                <span className='inline-flex items-center gap-1' title='Migration rate'>
                    <Percent className='h-3.5 w-3.5 text-muted' />
                    <span className={`tabular-nums font-medium ${rateCls}`}>
                        {dev.tokens.rate.toFixed(1)}%
                    </span>
                    <span className='text-muted font-mono'>rate</span>
                </span>

                {/* action buttons — после rate */}
                <span className='ml-auto inline-flex items-center gap-1.5'>
                    <button
                        type='button'
                        title={devLabel ? 'Edit label' : 'Set label'}
                        onClick={() => setLabelModalOpen(true)}
                        className='inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 transition-colors'
                    >
                        <Tag className='h-3.5 w-3.5' />
                    </button>
                    <button
                        type='button'
                        title='Blacklist this dev wallet'
                        onClick={() => void onBlacklist()}
                        className='inline-flex items-center gap-0.5 text-red-500 hover:text-red-400 transition-colors'
                    >
                        <Ban className='h-3.5 w-3.5' />
                    </button>
                </span>
            </div>

            {/* ── last migrated ── */}
            {lastMigrated.length > 0 && (
                <>
                    <Separator className='opacity-50' />

                    <div className='space-y-1.5'>
                        <div className='text-[11px] text-muted font-medium uppercase tracking-wide'>
                            Last migrated
                        </div>
                        <div className='flex flex-col gap-2'>
                            {lastMigrated.map(t => (
                                <MigratedTokenCard
                                    key={t.address || t.pair}
                                    t={t}
                                    solPrice={solPriceUsd}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* ── label modal ── */}
            <LabelModal
                open={labelModalOpen}
                onClose={() => setLabelModalOpen(false)}
                address={dev.address}
                currentLabel={devLabel ?? ''}
            />
        </div>
    )
}
