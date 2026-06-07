import { useMemo, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
    Search, Globe, Send, Users, User, Feather,
    ChefHat, Coins, GitMerge, Percent,
    BadgeDollarSign, ChartNoAxesCombined, HandCoins,
    Tag, Ban, Clock, Crown, Zap,
    BadgeCheck, AlertCircle, Check, Copy, Info, X,
    type LucideIcon
} from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'

import bonkIcon from '@/assets/protocols/bonk.svg'
import pumpIcon from '@/assets/protocols/pump.svg'
import mayhemIcon from '@/assets/protocols/mayhem.svg'
import axiomIcon from '@/assets/terminals/axiom.svg'
import padreIcon from '@/assets/terminals/padre.svg'
import gmgnIcon from '@/assets/terminals/gmgn.svg'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    HoverCard, HoverCardContent, HoverCardTrigger
} from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'
import {
    Dialog, DialogContent, DialogDescription, DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { cn } from '@/lib/utils'
import { formatAge, formatUsdCompact, shortAddress } from '@/lib/format'
import { terminalLink } from '@/lib/liveFeedTerminals'
import { useTokenOpener } from '@/hooks/useTokenOpener'
import { useTokenAnalyzer as useAnalyzerCtx } from '@/context/TokenAnalyzerContext'
import type {
    DevInfo,
    LastToken,
    TokenCardModel
} from '@/hooks/useTokenAnalyzer'
import type { FeesSource, Terminal } from '@/types/liveFeed'

function safeUrl(u: string): string {
    try {
        const parsed = new URL(u)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
        return parsed.toString()
    } catch {
        return ''
    }
}

function ExtLink({
    href,
    title,
    className,
    children
}: {
    href: string
    title?: string
    className?: string
    children: ReactNode
}) {
    return (
        <a
            href={href}
            onClick={(e) => { e.preventDefault(); void openUrl(href) }}
            target='_blank'
            rel='noreferrer'
            title={title}
            className={className}
        >
            {children}
        </a>
    )
}

type XKind = 'community' | 'post' | 'user'

const X_RESERVED_PATHS = new Set([
    'i', 'home', 'explore', 'notifications', 'messages',
    'search', 'settings', 'compose', 'login', 'signup'
])

function detectXKind(url: string): XKind | null {
    let parsed: URL
    try { parsed = new URL(url) } catch { return null }

    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'x.com' && host !== 'twitter.com') return null

    const path = parsed.pathname
    if (/^\/i\/communities\/\d+/.test(path)) return 'community'
    if (/\/status\/\d+/.test(path)) return 'post'

    const first = path.replace(/^\/+/, '').split('/')[0]?.toLowerCase()
    if (!first || X_RESERVED_PATHS.has(first)) return null
    return 'user'
}

const X_KIND_META: Record<XKind, { Icon: LucideIcon; title: string }> = {
    community: { Icon: Users, title: 'X community' },
    post: { Icon: Feather, title: 'X post' },
    user: { Icon: User, title: 'X profile' }
}

// --- constants ---

const PROTOCOLS: Record<
    string,
    { href: (address: string) => string; icon: string; title: string }
> = {
    pump: {
        href: (address) => `https://pump.fun/coin/${address}`,
        icon: pumpIcon,
        title: 'pump.fun'
    },
    bonk: {
        href: (address) => `https://bonk.fun/token/${address}`,
        icon: bonkIcon,
        title: 'bonk.fun'
    }
}

const TERMINAL_META: Record<Terminal, { icon: string; label: string }> = {
    axiom: { icon: axiomIcon, label: 'Axiom' },
    padre: { icon: padreIcon, label: 'Padre' },
    gmgn: { icon: gmgnIcon, label: 'GMGN' }
}

const ICON_LINK_CLS = 'hover:text-zinc-200 transition-colors'

// --- funding hover-card ---

function FundingCard({
    dev,
    isBlacklisted,
    isWhitelisted,
    devLabel
}: {
    dev: DevInfo
    isBlacklisted: boolean
    isWhitelisted: boolean
    devLabel: string | undefined
}) {
    const funding = dev.funding

    const LeadIcon = isWhitelisted && !isBlacklisted ? BadgeCheck : ChefHat
    const leadIconCls = cn(
        'size-3.5',
        isWhitelisted && !isBlacklisted && 'text-emerald-400'
    )

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
                        <div className='space-y-1'>
                            <div className='flex items-center justify-between'>
                                {devLabel
                                    ? <span className='text-[11px] text-sky-300 uppercase tracking-wide truncate max-w-[60%]' title={devLabel}>{devLabel}</span>
                                    : <span className='text-[11px] text-muted'>Dev</span>
                                }
                                <FundingAddress address={dev.address} />
                            </div>
                            {funding.funding_wallet && (
                                <div className='flex items-center justify-between'>
                                    <span className='text-[11px] text-muted'>Funder</span>
                                    <FundingAddress address={funding.funding_wallet!} />
                                </div>
                            )}
                        </div>

                        <Separator className='opacity-30' />

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
                                        {formatAge(funding.funded_at)} ago
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

function FundingAddress({ address }: { address: string }) {
    const [copied, setCopied] = useState(false)

    const copy = (e: React.MouseEvent) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(address)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
    }

    return (
        <button
            type='button'
            onClick={copy}
            title={`Copy ${address}`}
            aria-label='Copy address'
            className='inline-flex items-center gap-1.5 px-1.5 -mx-1.5 rounded font-mono text-[11px] text-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer'
        >
            <span>{shortAddress(address)}</span>
            {copied
                ? <Check className='size-3 text-emerald-400' />
                : <Copy className='size-3 opacity-70' />}
        </button>
    )
}

// --- label modal (set / edit a wallet tracker label) ---

const LABEL_RE = /^[a-z0-9_-]{4,16}$/

function LabelModal({
    open,
    onClose,
    address,
    currentLabel
}: {
    open: boolean
    onClose: () => void
    address: string
    currentLabel: string
}) {
    const { upsertTracker } = useAnalyzerCtx()
    const [value, setValue] = useState(currentLabel)

    const trimmed = value.trim()
    const valid = LABEL_RE.test(trimmed)
    const invalid = trimmed !== '' && !valid

    const commit = () => {
        if (!valid) return
        upsertTracker(address, { label: trimmed })
        toast.success(`Label saved: ${trimmed}`)
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
            <DialogContent>
                <div>
                    <DialogTitle>Label wallet</DialogTitle>
                    <DialogDescription className='mt-1 font-mono text-xs break-all text-muted'>
                        {address}
                    </DialogDescription>
                </div>
                <div className='space-y-3'>
                    <div>
                        <Input
                            value={value}
                            maxLength={16}
                            placeholder='e.g. mayhem_bot'
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter')  { e.preventDefault(); commit() }
                                if (e.key === 'Escape') { e.preventDefault(); onClose() }
                            }}
                            aria-invalid={invalid}
                            className='bg-field border-white/10'
                        />
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
                            <span>
                                4-16 characters: lowercase letters, digits, - and _
                            </span>
                        </div>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={onClose}
                            className='flex-1'
                        >
                            <X className='size-4' />
                            Cancel
                        </Button>
                        <Button
                            size='sm'
                            onClick={commit}
                            disabled={!valid}
                            className='flex-1'
                        >
                            <Check className='size-4' />
                            Save
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// --- last token card (one of the three rows under dev stats) ---

function LastTokenCard({
    t,
    solPrice,
    terminal,
    feesSource
}: {
    t: LastToken
    solPrice: number | null
    terminal: Terminal
    feesSource: FeesSource
}) {
    const openToken = useTokenOpener()

    const mcUsd = solPrice && t.market_cap > 0 ? t.market_cap : null
    const athUsd = t.ath_mcap > 0               ? t.ath_mcap   : null
    const agoText = t.created_at ? formatAge(t.created_at) : ''
    const isMigrated = t.is_migrated === true

    const dexCls = t.dex_paid ? 'text-emerald-400' : 'text-red-400'

    return (
        <a
            href={terminalLink(t.address, terminal)}
            target='_blank'
            rel='noreferrer'
            onClick={(e) => {
                e.preventDefault()
                void openToken(t.address, t.pair, terminal)
            }}
            className='flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-white/3 ring-1 ring-white/8 hover:bg-white/6 transition-colors min-w-0 cursor-pointer'
        >
            <Avatar className='size-8 rounded-lg shrink-0'>
                <AvatarImage src={t.image} className='rounded-lg object-cover' />
                <AvatarFallback className='rounded-lg bg-white/5 text-xs'>
                    {t.ticker.slice(0, 2) || '??'}
                </AvatarFallback>
            </Avatar>

            <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-1.5 min-w-0'>
                    <span className='text-sm font-semibold text-zinc-100 shrink-0'>
                        {t.ticker.toUpperCase()}
                    </span>
                    {t.address && (
                        <span className='text-xs text-muted truncate'>
                            {shortAddress(t.address)}
                        </span>
                    )}
                    {isMigrated && (
                        <span className='inline-flex items-center gap-1 ml-auto shrink-0'>
                            <Crown className='size-3.5 text-amber-400' />
                        </span>
                    )}
                </div>

                <div className='flex flex-wrap items-center gap-2 mt-1'>
                    {agoText && (
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            <Clock className='size-3.5' />
                            <span className='tabular-nums text-indigo-400 font-medium'>{agoText}</span>
                        </span>
                    )}

                    {mcUsd !== null && (
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            <ChartNoAxesCombined className='size-4' />
                            <span className='tabular-nums text-emerald-300 font-medium'>{formatUsdCompact(mcUsd)}</span>
                            {athUsd !== null && (
                                <>
                                    <Zap className='size-3.5 text-white/80' />
                                    <span className='tabular-nums text-amber-300 font-medium'>{formatUsdCompact(athUsd)}</span>
                                </>
                            )}
                        </span>
                    )}

                    <span className='inline-flex items-center gap-2'>
                        <span className='inline-flex items-center gap-1 text-xs text-white/80'>
                            <HandCoins className='size-4' />
                            <span className='tabular-nums text-violet-400 font-medium'>
                                {((feesSource === 'axiom' ? t.fees.axiom : t.fees.gmgn) ?? 0).toFixed(2)} SOL
                            </span>
                        </span>

                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${dexCls}`}>
                            <BadgeDollarSign className='size-4' />
                            DEX
                        </span>
                    </span>
                </div>
            </div>
        </a>
    )
}

// --- token row (main card) ---

export function TokenRow({
    item,
    solPriceUsd
}: {
    item: TokenCardModel
    solPriceUsd: number | null
}) {
    const { token, dev, lastTokens } = item
    const metadata = token.metadata

    const {
        config,
        activeFilters,
        upsertTracker,
        isWhitelistedDev,
        isBlacklistedDev
    } = useAnalyzerCtx()

    const openToken = useTokenOpener()
    const termMeta = TERMINAL_META[config.app.terminal]

    const [labelModalOpen, setLabelModalOpen] = useState(false)

    const devKey = dev.address.toLowerCase()
    const devLabel = config.trackers[devKey]?.label ?? undefined
    const ticker = token.ticker?.trim() ? token.ticker.toUpperCase() : 'NA'
    const name = token.name
    const avatarUrl = metadata?.image ? safeUrl(metadata.image) : ''

    const newMcUsd = solPriceUsd && token.market_cap > 0
        ? token.market_cap * solPriceUsd
        : null

    const links = useMemo(() => ({
        website:  metadata?.website  ? safeUrl(metadata.website)  : '',
        telegram: metadata?.telegram ? safeUrl(metadata.telegram) : '',
        x:        metadata?.xlink    ? safeUrl(metadata.xlink)    : ''
    }), [metadata?.website, metadata?.telegram, metadata?.xlink])

    const xKindMeta = useMemo(() => {
        if (!links.x) return null
        const kind = detectXKind(links.x)
        return kind ? X_KIND_META[kind] : null
    }, [links.x])

    const protocol = token.protocol
    const proto = protocol ? PROTOCOLS[protocol] : null
    const isMayhem = token.is_mayhem_mode === true
    const protoIcon = protocol === 'pump' && isMayhem ? mayhemIcon : proto?.icon
    const protoTitle = protocol === 'pump' && isMayhem ? 'pump.fun (mayhem)' : proto?.title

    const onCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(token.address)
            toast.success('Address successfully copied', { icon: '📋' })
        } catch {
            toast.error('Failed to copy address')
        }
    }

    const onBlacklist = () => {
        if (isBlacklistedDev(dev.address)) {
            toast.error('Already blacklisted')
            return
        }
        upsertTracker(dev.address, { list: 'blacklist' })
        toast.success('Dev wallet blacklisted')
    }

    const onWhitelist = () => {
        if (isWhitelistedDev(dev.address)) {
            toast.error('Already whitelisted')
            return
        }
        upsertTracker(dev.address, { list: 'whitelist' })
        toast.success('Dev wallet whitelisted')
    }

    const rateCls =
        dev.tokens.rate >= 25 ? 'text-emerald-400' :
        dev.tokens.rate >= 5  ? 'text-amber-300'   : 'text-red-400'

    const devholdCls =
        token.devhold >= 25 ? 'text-red-400'      :
        token.devhold >= 10 ? 'text-amber-300'    : 'text-emerald-300'

    const isWhitelisted = isWhitelistedDev(dev.address)
    const isBlacklisted = isBlacklistedDev(dev.address)

    return (
        <div className='rounded-2xl px-3 py-2.5 bg-panel/60 border border-line space-y-2.5'>

            <div className='flex items-start gap-3'>
                <div className='relative group shrink-0'>
                    <Avatar className='size-10 rounded-lg'>
                        <AvatarImage src={avatarUrl} className='rounded-lg object-cover' />
                        <AvatarFallback className='rounded-lg bg-white/5 text-xs'>
                            {ticker.slice(0, 2) || '??'}
                        </AvatarFallback>
                    </Avatar>

                    {avatarUrl && (
                        <div className='pointer-events-none absolute left-0 top-0 z-50 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition duration-150 ease-out -translate-y-1 -translate-x-1 origin-top-left'>
                            <div className='size-40 rounded-xl overflow-hidden ring-1 ring-white/15 bg-zinc-950/60 backdrop-blur'>
                                <img src={avatarUrl} alt={ticker} className='size-full object-cover' draggable={false} />
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
                            <ExtLink
                                href={proto.href(token.address)}
                                title={protoTitle}
                                className='hover:opacity-80 transition-opacity'
                            >
                                <img src={protoIcon} alt={protoTitle} className='size-4' draggable={false} />
                            </ExtLink>
                        )}

                        <a
                            href={terminalLink(token.address, config.app.terminal)}
                            target='_blank' rel='noreferrer'
                            title={`View on ${termMeta.label}`}
                            onClick={(e) => {
                                e.preventDefault()
                                void openToken(token.address, token.pair, config.app.terminal)
                            }}
                            className='hover:opacity-80 transition-opacity cursor-pointer'
                        >
                            <img src={termMeta.icon} alt={termMeta.label} className='size-4' draggable={false} />
                        </a>

                        {links.x && xKindMeta && (
                            <ExtLink
                                href={links.x}
                                title={`${xKindMeta.title}: ${links.x}`}
                                className='text-brand-x hover:text-brand-x/80 transition-colors'
                            >
                                <xKindMeta.Icon className='size-4' />
                            </ExtLink>
                        )}

                        {links.website && (
                            <ExtLink
                                href={links.website}
                                title={links.website}
                                className={ICON_LINK_CLS}
                            >
                                <Globe className='size-4' />
                            </ExtLink>
                        )}
                        {links.telegram && (
                            <ExtLink
                                href={links.telegram}
                                title={links.telegram}
                                className={ICON_LINK_CLS}
                            >
                                <Send className='size-4' />
                            </ExtLink>
                        )}

                        <ExtLink
                            href={`https://x.com/search?q=${token.address}&src=typed_query&f=live`}
                            title='Search on X'
                            className={ICON_LINK_CLS}
                        >
                            <Search className='size-4' />
                        </ExtLink>
                    </div>
                </div>

                <div className='shrink-0 flex flex-col items-end gap-1.5'>
                    {newMcUsd !== null && (
                        <span className='inline-flex items-center gap-1 text-xs text-muted'>
                            <ChartNoAxesCombined className='size-3.5' />
                            <span className='tabular-nums text-emerald-300 font-semibold'>{formatUsdCompact(newMcUsd)}</span>
                        </span>
                    )}
                    <span className='inline-flex items-center gap-1 text-xs text-muted'>
                        <ChefHat className='size-3.5' />
                        <span className={`tabular-nums font-semibold ${devholdCls}`}>{token.devhold}%</span>
                    </span>
                </div>
            </div>

            <Separator className='opacity-50' />

            <div className='flex items-start justify-between gap-3 text-xs'>
                <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0'>
                    <FundingCard
                        dev={dev}
                        isBlacklisted={isBlacklisted}
                        isWhitelisted={isWhitelisted}
                        devLabel={devLabel}
                    />

                    <span className='inline-flex items-center gap-1' title='Total tokens created'>
                        <Coins className='size-3.5 text-muted' />
                        <span className='tabular-nums text-white font-medium'>{dev.tokens.total}</span>
                        <span className='text-muted font-mono'>tokens</span>
                    </span>

                    <span className='inline-flex items-center gap-3'>
                        <span className='inline-flex items-center gap-1' title='Migrated tokens'>
                            <GitMerge className='size-3.5 text-muted' />
                            <span className='tabular-nums text-white font-medium'>{dev.tokens.migrated}</span>
                            <span className='text-muted font-mono'>migrated</span>
                        </span>

                        <span className='inline-flex items-center gap-1' title='Migration rate'>
                            <Percent className='size-3.5 text-muted' />
                            <span className={`tabular-nums font-medium ${rateCls}`}>
                                {dev.tokens.rate.toFixed(1)}%
                            </span>
                            <span className='text-muted font-mono'>rate</span>
                        </span>
                    </span>
                </div>

                <span className='shrink-0 inline-flex items-center gap-1.5'>
                    <button
                        type='button'
                        title={devLabel ? 'Edit label' : 'Set label'}
                        onClick={() => setLabelModalOpen(true)}
                        className='inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer'
                    >
                        <Tag className='size-3.5' />
                    </button>
                    <button
                        type='button'
                        title='Whitelist this dev wallet'
                        onClick={onWhitelist}
                        className='inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer'
                    >
                        <BadgeCheck className='size-3.5' />
                    </button>
                    <button
                        type='button'
                        title='Blacklist this dev wallet'
                        onClick={onBlacklist}
                        className='inline-flex items-center gap-0.5 text-red-500 hover:text-red-400 transition-colors cursor-pointer'
                    >
                        <Ban className='size-3.5' />
                    </button>
                </span>
            </div>

            {lastTokens.length > 0 && (
                <>
                    <Separator className='opacity-50' />

                    <div className='space-y-1.5'>
                        <div className='text-[11px] text-muted font-medium uppercase tracking-wide'>
                            Last tokens
                        </div>
                        <div className='flex flex-col gap-2'>
                            {lastTokens.map((t) => (
                                <LastTokenCard
                                    key={t.address || t.ticker}
                                    t={t}
                                    solPrice={solPriceUsd}
                                    terminal={config.app.terminal}
                                    feesSource={activeFilters.fees.source}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}

            <LabelModal
                open={labelModalOpen}
                onClose={() => setLabelModalOpen(false)}
                address={dev.address}
                currentLabel={devLabel ?? ''}
            />
        </div>
    )
}
