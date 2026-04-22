import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

import { terminalLink } from '@/lib/refferal'
import { Separator } from '@/components/ui/separator'
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import bonkIcon   from '@/assets/bonk.svg'
import pumpIcon   from '@/assets/pump.svg'

import mayhemIcon from '@/assets/mayhem.svg'
import axiomIcon  from '@/assets/terminals/axiom.svg'
import padreIcon  from '@/assets/terminals/padre.svg'
import gmgnIcon   from '@/assets/terminals/gmgn.svg'

import type { Terminal, FeesTerminal, CreatorLabelData } from '@/context/SettingsContext'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    Search,
    Globe, Send,
    ChefHat, Coins, GitMerge, Percent,
    BadgeDollarSign, ChartNoAxesCombined, HandCoins,
    Tag, Ban, Clock, Crown, Zap, DatabaseZap,
    Feather, User, Users,
    Pencil, BadgeCheck, Check, X,
    History,
} from 'lucide-react'

import type { TokenCardModel, LastToken, Metadata, XCommunity, DevInfo } from '@/hooks/useSparkTokens'
import { useSettings } from '@/context/SettingsContext'

// ─── helpers ─────────────────────────────────────────────────────────────────

function safeUrl(u: string) {
    try { return new URL(u).toString() } catch { return '' }
}

function fmtUsdCap(usd: number): string {
    if (!Number.isFinite(usd) || usd <= 0) return '0.0'
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
    if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(1)}k`
    return `$${usd.toFixed(0)}`
}

function fmtSol(sol: number): string {
    if (!Number.isFinite(sol)) return '0.0'
    return sol.toFixed(2)
}

function fmtAgo(tsMs: number): string {
    if (!tsMs) return ''
    try { return formatDistanceToNow(new Date(tsMs), { addSuffix: false }) }
    catch { return '' }
}

function truncAddr(addr: string): string {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

function fmtCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
    return String(n)
}

function fmtShortDate(tsMs: number): string {
    if (!tsMs) return ''
    try {
        const d = new Date(tsMs)
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    } catch { return '' }
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

const TERMINAL_META: Record<Terminal, { icon: string; label: string }> = {
    axiom: { icon: axiomIcon, label: 'Axiom' },
    padre: { icon: padreIcon, label: 'Padre' },
    gmgn:  { icon: gmgnIcon,  label: 'GMGN'  },
}

const DEFAULT_LABEL_COLOR = '#7dd3fc'

// ─── X entity icon ───────────────────────────────────────────────────────────

function XEntityIcon({ metadata }: { metadata: Metadata }) {
    const xtype = metadata.xtype?.[0]
    if (!xtype || !metadata.xlink) return null

    const url = safeUrl(metadata.xlink)
    if (!url) return null

    const Icon = xtype === 'community' ? Users
               : xtype === 'post'      ? Feather
               : xtype === 'user'      ? User
               : null

    if (!Icon) return null

    return (
        <a href={url} target='_blank' rel='noreferrer'
           className='text-[#5dbcff] hover:text-[#5dbcff]/80 transition-colors'
           title={url}>
            <Icon className='h-4 w-4' />
        </a>
    )
}

// ─── Community hover card ────────────────────────────────────────────────────

function CommunityCard({
    metadata,
    creatorLabelData,
}: {
    metadata: Metadata
    creatorLabelData: CreatorLabelData | undefined
}) {
    const community = metadata.xcommunity
    if (!community) return <XEntityIcon metadata={metadata} />

    const url = metadata.xlink ? safeUrl(metadata.xlink) : ''
    const creator = community.creator
    const badgeColor = creatorLabelData?.color ?? '#5dbcff'

    return (
        <HoverCard openDelay={10} closeDelay={100}>
            <HoverCardTrigger asChild>
                <span className='inline-flex items-center gap-1 cursor-pointer'>
                    {creatorLabelData ? (
                        <div
                            className='text-xs flex space-x-2 px-1.5 py-0.5 rounded-sm'
                            style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
                        >
                            <a href={url || undefined} target='_blank' rel='noreferrer'
                                className='hover:opacity-80 transition-opacity'>
                                <Users className='size-4' />
                            </a>
                            <span className='text-white'>/</span>
                            <span className='font-medium uppercase'>{creatorLabelData.label}</span>
                        </div>
                    ) : (
                        <a href={url || undefined} target='_blank' rel='noreferrer'
                            className='text-[#5dbcff] hover:text-[#5dbcff]/80 transition-colors'>
                            <Users className='h-4 w-4' />
                        </a>
                    )}
                </span>
            </HoverCardTrigger>
            <HoverCardContent
                side='top'
                align='start'
                className='w-72 bg-zinc-900/70 backdrop-blur border-line p-0 overflow-hidden'
            >
                {/* banner */}
                {community.banner_url && (
                    <div className='w-full overflow-hidden'>
                        <img src={community.banner_url} alt='' className='w-full object-contain' draggable={false} />
                    </div>
                )}

                <div className='px-3 py-3 space-y-2.5'>
                    {/* community info */}
                    <div>
                        {url ? (
                            <a href={url} target='_blank' rel='noreferrer'
                               className='text-sm font-semibold text-white hover:underline'>
                                {community.name}
                            </a>
                        ) : (
                            <span className='text-sm font-semibold text-white'>{community.name}</span>
                        )}
                        <div className='flex items-center gap-1 mt-0.5'>
                            {community.access && (
                                <span className='text-[10px] text-muted lowercase'>{community.access}</span>
                            )}
                            <span className='text-[10px] text-muted'>/</span>
                            <span className='text-[10px] text-muted'>
                                {fmtCount(community.members)} members
                            </span>
                            {community.created_at > 0 && (
                                <>
                                    <span className='text-[10px] text-muted'>/</span>
                                    <span className='text-[10px] text-indigo-400'>
                                        {fmtAgo(community.created_at)} ago
                                    </span>
                                </>
                            )}
                        </div>
                        {community.description && (
                            <p className='text-xs text-white/70 mt-1.5 line-clamp-3'>{community.description}</p>
                        )}
                    </div>

                    {/* creator */}
                    {creator && (
                        <>
                            <Separator className='opacity-50' />
                            <CreatorRow community={community} />
                        </>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}

function CreatorRow({ community }: { community: XCommunity }) {
    const { creatorLabels, setCreatorLabel, addCreatorToBlacklist, isCreatorBlacklisted } = useSettings()
    const creator = community.creator!

    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState('')
    const [editColor, setEditColor] = useState(DEFAULT_LABEL_COLOR)

    const screenKey = (creator.username ?? '').toLowerCase()
    const currentLabelData = screenKey ? creatorLabels[screenKey] : undefined

    const startEdit = () => {
        setEditValue(currentLabelData?.label ?? creator.name ?? '')
        setEditColor(currentLabelData?.color ?? DEFAULT_LABEL_COLOR)
        setEditing(true)
    }

    const saveEdit = async () => {
        const trimmed = editValue.trim()
        if (!trimmed || !creator.username) return
        await setCreatorLabel(creator.username, trimmed, editColor)
        toast.success('Creator label saved')
        setEditing(false)
    }

    const onBlockCreator = async () => {
        if (!creator.username) return
        if (isCreatorBlacklisted(creator.username)) {
            toast.error('Already blocked')
            return
        }
        await addCreatorToBlacklist(creator.username)
        toast.success('Creator blocked')
    }

    return (
        <div className={`flex gap-2 ${editing ? 'items-center' : 'items-start'}`}>
            {creator.avatar_url && (
                <Avatar className='size-10 rounded-lg shrink-0'>
                    <AvatarImage src={creator.avatar_url} className='rounded-lg object-cover' />
                    <AvatarFallback className='rounded-lg bg-white/5 text-[10px]'>
                        {(creator.name ?? '?').slice(0, 2)}
                    </AvatarFallback>
                </Avatar>
            )}
            <div className='min-w-0 flex-1'>
                {editing ? (
                    <div className='flex items-center gap-1'>
                        <label className='relative shrink-0 size-5 rounded cursor-pointer hover:opacity-80 transition-opacity' style={{ backgroundColor: editColor }}>
                            <input
                                type='color'
                                value={editColor}
                                onChange={e => { e.stopPropagation(); setEditColor(e.target.value) }}
                                className='absolute inset-0 size-full cursor-pointer opacity-0'
                                style={{ colorScheme: 'dark' }}
                            />
                        </label>
                        <input
                            autoFocus
                            value={editValue}
                            maxLength={16}
                            placeholder='Label...'
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter')  { e.preventDefault(); e.stopPropagation(); void saveEdit() }
                                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(false) }
                            }}
                            className='h-5 flex-1 min-w-0 rounded bg-white/10 border-none px-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/50'
                        />
                        <button
                            type='button'
                            onClick={e => { e.preventDefault(); e.stopPropagation(); void saveEdit() }}
                            className='text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors shrink-0'
                            title='Save'
                        >
                            <Check className='size-3.5' />
                        </button>
                        <button
                            type='button'
                            onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(false) }}
                            className='text-red-400/80 hover:text-red-300 cursor-pointer transition-colors shrink-0'
                            title='Cancel'
                        >
                            <X className='size-3.5' />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className='flex items-center gap-1'>
                            <span className='text-xs font-medium text-white truncate'>
                                {currentLabelData?.label ?? creator.name ?? 'Unknown'}
                            </span>
                            {creator.is_verified && (
                                <BadgeCheck className='size-3 text-sky-400' />
                            )}
                            <button
                                type='button'
                                onClick={e => { e.preventDefault(); e.stopPropagation(); startEdit() }}
                                className='text-muted/80 hover:text-zinc-100 cursor-pointer transition-colors shrink-0 ml-0.5'
                                title='Set custom name'
                            >
                                <Pencil className='size-3' />
                            </button>
                        </div>

                        {creator.username && (
                            <div className='flex items-center gap-1 mt-0.5'>
                                <a
                                    href={`https://x.com/${creator.username}`}
                                    target='_blank' rel='noreferrer'
                                    className='text-xs text-muted hover:underline'
                                >
                                    @{creator.username}
                                </a>
                                <button
                                    type='button'
                                    onClick={e => { e.preventDefault(); e.stopPropagation(); void onBlockCreator() }}
                                    className='text-red-500/80 hover:text-red-400 cursor-pointer transition-colors shrink-0'
                                    title='Block creator'
                                >
                                    <Ban className='size-3' />
                                </button>
                            </div>
                        )}
                    </>
                )}

                <div className='flex items-center gap-2 mt-0.5'>
                    <span className='text-[10px] font-medium text-muted'>
                        {fmtCount(creator.followers)} followers
                    </span>
                    <span className='text-[10px] font-medium text-muted'>
                        {fmtCount(creator.following)} following
                    </span>
                    {creator.joined_at > 0 && (
                        <span className='text-[10px] font-medium text-indigo-400'>
                            {fmtShortDate(creator.joined_at)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Funding hover card ─────────────────────────────────────────────────────

function FundingCard({
    dev,
    isBlacklisted,
    isWhitelisted,
    devLabel,
}: {
    dev: DevInfo
    isBlacklisted: boolean
    isWhitelisted: boolean
    devLabel: string | undefined
}) {
    const funding = dev.funding

    const copyAddr = (addr: string) => {
        navigator.clipboard.writeText(addr)
        toast.success('Copied to clipboard')
    }

    const LeadIcon = isWhitelisted && !isBlacklisted ? BadgeCheck : ChefHat
    const leadIconCls = isWhitelisted && !isBlacklisted
        ? 'h-3.5 w-3.5 text-emerald-400'
        : 'h-3.5 w-3.5'

    return (
        <HoverCard openDelay={10} closeDelay={100}>
            <HoverCardTrigger asChild>
                <span className='inline-flex items-center gap-1 text-muted text-xs font-medium uppercase tracking-wide cursor-pointer'>
                    <LeadIcon className={leadIconCls} />
                    {isBlacklisted
                        ? <span className='text-rose-400 uppercase'>Banned</span>
                        : isWhitelisted
                            ? <span className='text-emerald-400 uppercase'>Trusted</span>
                            : devLabel
                                ? <span className='text-sky-300 uppercase'>{devLabel}</span>
                                : 'DEV'
                    }
                </span>
            </HoverCardTrigger>
            <HoverCardContent
                side='bottom'
                align='start'
                className='w-56 bg-zinc-900/70 backdrop-blur border-line p-0 overflow-hidden'
            >
                {funding ? (
                    <div className='px-3 py-2.5 space-y-2'>
                        {/* wallets */}
                        <div className='space-y-1'>
                            <div className='flex items-center justify-between'>
                                {devLabel
                                    ? <span className='text-[11px] text-sky-300 uppercase tracking-wide truncate max-w-[60%]' title={devLabel}>{devLabel}</span>
                                    : <span className='text-[11px] text-muted'>Dev</span>
                                }
                                <span
                                    onClick={() => copyAddr(dev.address)}
                                    className='text-[11px] text-muted font-mono cursor-pointer hover:text-white transition-colors'
                                >
                                    {truncAddr(dev.address)}
                                </span>
                            </div>
                            {funding.funding_wallet && (
                                <div className='flex items-center justify-between'>
                                    <span className='text-[11px] text-muted'>Funder</span>
                                    <span
                                        onClick={() => copyAddr(funding.funding_wallet!)}
                                        className='text-[11px] text-muted font-mono cursor-pointer hover:text-white transition-colors'
                                    >
                                        {truncAddr(funding.funding_wallet)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <Separator className='opacity-30' />

                        {/* amount & time */}
                        <div className='space-y-1'>
                            <div className='flex items-center justify-between'>
                                <span className='text-[11px] text-muted'>Amount</span>
                                <span className='text-[11px] text-violet-400 font-medium tabular-nums'>
                                    {funding.amount} SOL
                                </span>
                            </div>
                            {funding.funded_at > 0 && (
                                <div className='flex items-center justify-between'>
                                    <span className='text-[11px] text-muted'>When</span>
                                    <span className='text-[11px] text-indigo-400 font-medium tabular-nums'>
                                        {fmtAgo(funding.funded_at)} ago
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className='px-3 py-2.5'>
                        <span className='text-[11px] text-muted'>No funding data</span>
                    </div>
                )}
            </HoverCardContent>
        </HoverCard>
    )
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

// ─── LastTokenCard ────────────────────────────────────────────────────────────

function LastTokenCard({
    t,
    solPrice,
    terminal,
    feesTerminal,
}: {
    t: LastToken
    solPrice: number | null
    terminal: Terminal
    feesTerminal: FeesTerminal
}) {
    const mcUsd    = solPrice && t.market_cap > 0 ? t.market_cap : null
    const athUsd   = t.ath_mcap > 0               ? t.ath_mcap             : null
    const agoText  = t.created_at ? fmtAgo(t.created_at) : ''
    const isMigrated = t.is_migrated === true

    const dexCls = t.dex_paid ? 'text-emerald-400' : 'text-red-400'

    return (
        <a
            href={terminalLink(t.address, terminal)}
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
            <Avatar className='h-8 w-8 rounded-lg shrink-0'>
                <AvatarImage src={t.image} className='rounded-lg object-cover' />
                <AvatarFallback className='rounded-lg bg-white/5 text-xs'>
                    {t.ticker.slice(0, 2) || '??'}
                </AvatarFallback>
            </Avatar>

            <div className='min-w-0 flex-1'>
                {/* ticker + address + migrated crown */}
                <div className='flex items-center gap-1.5 min-w-0'>
                    <span className='text-sm font-semibold text-zinc-100 shrink-0'>
                        {t.ticker.toUpperCase()}
                    </span>
                    {t.address && (
                        <span className='text-xs text-muted truncate'>
                            {t.address.slice(0, 4)}...{t.address.slice(-4)}
                        </span>
                    )}
                    {(t.is_tracked || isMigrated) && (
                        <span className='inline-flex items-center gap-1 ml-auto shrink-0'>
                            {t.is_tracked && <DatabaseZap className='h-3.5 w-3.5 text-cyan-400' />}
                            {isMigrated && <Crown className='h-3.5 w-3.5 text-amber-400' />}
                        </span>
                    )}
                </div>

                {/* date + mcap + ath mcap + fees + dex */}
                <div className='flex items-center space-x-2 mt-1 flex-wrap'>
                    {agoText && (
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            <Clock className='size-3.5' />
                            <span className='tabular-nums text-indigo-400 font-medium'>{agoText}</span>
                        </span>
                    )}

                    {mcUsd !== null && (
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            <ChartNoAxesCombined className='size-4' />
                            <span className='tabular-nums text-emerald-300 font-medium'>{fmtUsdCap(mcUsd)}</span>
                            {athUsd !== null && (
                                <>
                                    <Zap className='size-3.5 text-white/80' />
                                    <span className='tabular-nums text-amber-300 font-medium'>{fmtUsdCap(athUsd)}</span>
                                </>
                            )}
                        </span>
                    )}

                    <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                        <HandCoins className='size-4' />
                        <span className='tabular-nums text-violet-400 font-medium'>
                            {fmtSol((feesTerminal === 'axiom' ? t.fees.axiom : t.fees.gmgn) ?? 0)} SOL
                        </span>
                    </span>

                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${dexCls}`}>
                        <BadgeDollarSign className='h-4 w-4' />
                        DEX
                    </span>
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
    const { token, dev, lastTokens } = item
    const metadata = token.metadata
    const { settings, walletLabels, creatorLabels, addToBlacklist, isBlacklisted, addToDevWhitelist, isDevWhitelisted } = useSettings()
    const termMeta = TERMINAL_META[settings.terminal]

    const [labelModalOpen, setLabelModalOpen] = useState(false)

    const devLabel  = walletLabels[dev.address]
    const ticker    = token.ticker?.trim() ? token.ticker.toUpperCase() : 'NA'
    const name      = token.name
    const avatarUrl = metadata?.image ? safeUrl(metadata.image) : ''

    // mcap нового токена в USD
    const newMcUsd = solPriceUsd && token.market_cap > 0
        ? token.market_cap * solPriceUsd
        : null

    const links = useMemo(() => ({
        website:  metadata?.website  ? safeUrl(metadata.website)  : '',
        telegram: metadata?.telegram ? safeUrl(metadata.telegram) : '',
    }), [metadata?.website, metadata?.telegram])

    // creator label for community hover card badge
    const creatorLabelData = metadata?.xcommunity?.creator?.username
        ? creatorLabels[metadata.xcommunity.creator.username.toLowerCase()]
        : undefined

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
        if (isBlacklisted(dev.address)) {
            toast.error('Already blacklisted')
            return
        }
        await addToBlacklist(dev.address)
        toast.success('Dev wallet blacklisted')
    }

    const onWhitelist = async () => {
        if (isDevWhitelisted(dev.address)) {
            toast.error('Already whitelisted')
            return
        }
        await addToDevWhitelist(dev.address)
        toast.success('Dev wallet whitelisted')
    }

    const iconLinkCls = 'hover:text-zinc-200 transition-colors'

    const rateCls =
        dev.tokens.rate >= 25 ? 'text-emerald-400' :
        dev.tokens.rate >= 5  ? 'text-amber-300'   : 'text-red-400'

    const devholdCls =
        token.devhold >= 25 ? 'text-red-400' :
        token.devhold >= 10  ? 'text-amber-300'   : 'text-emerald-300'

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

                {/* center: ticker + links */}
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

                        <a href={terminalLink(token.address, settings.terminal)} target='_blank' rel='noreferrer'
                           title={`View on ${termMeta.label}`} className='hover:opacity-80 transition-opacity'>
                            <img src={termMeta.icon} alt={termMeta.label} className='h-4 w-4' draggable={false} />
                        </a>

                        {/* X entity: community with hover card, or post/user icon */}
                        {metadata && metadata.xtype?.[0] === 'community' && metadata.xcommunity ? (
                            <CommunityCard metadata={metadata} creatorLabelData={creatorLabelData} />
                        ) : metadata ? (
                            <XEntityIcon metadata={metadata} />
                        ) : null}

                        {/* duplicate-community indicator — token shares X community with a previously-seen one */}
                        {!token.is_community_duplicate && metadata?.xtype?.[0] === 'community' && (
                            <span
                                className='inline-flex items-center gap-1 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300'
                                title='Duplicate Community Detected'
                            >
                                <History className='h-3 w-3' />
                                Reused
                            </span>
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
                    </div>
                </div>

                {/* right: mcap + devhold */}
                <div className='shrink-0 flex flex-col items-end gap-1.5'>
                    {newMcUsd !== null && (
                        <span className='inline-flex items-center gap-1 text-xs text-muted'>
                            <ChartNoAxesCombined className='size-3.5' />
                            <span className='tabular-nums text-emerald-300 font-semibold'>{fmtUsdCap(newMcUsd)}</span>
                        </span>
                    )}
                    <span className='inline-flex items-center gap-1 text-xs text-muted'>
                        <ChefHat className='size-3.5' />
                        <span className={`tabular-nums font-semibold ${devholdCls}`}>{token.devhold}%</span>
                    </span>
                </div>
            </div>

            {/* ── dev stats ── */}
            <Separator className='opacity-50' />

            <div className='flex items-center gap-3 text-xs flex-wrap'>
                <FundingCard
                    dev={dev}
                    isBlacklisted={isBlacklisted(dev.address)}
                    isWhitelisted={isDevWhitelisted(dev.address)}
                    devLabel={devLabel}
                />

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
                        title='Whitelist this dev wallet'
                        onClick={() => void onWhitelist()}
                        className='inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 transition-colors'
                    >
                        <BadgeCheck className='h-3.5 w-3.5' />
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

            {/* ── last tokens ── */}
            {lastTokens.length > 0 && (
                <>
                    <Separator className='opacity-50' />

                    <div className='space-y-1.5'>
                        <div className='text-[11px] text-muted font-medium uppercase tracking-wide'>
                            Last tokens
                        </div>
                        <div className='flex flex-col gap-2'>
                            {lastTokens.map(t => (
                                <LastTokenCard
                                    key={t.address || t.ticker}
                                    t={t}
                                    solPrice={solPriceUsd}
                                    terminal={settings.terminal}
                                    feesTerminal={settings.feesTerminal}
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
