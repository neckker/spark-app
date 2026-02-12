import { useMemo } from 'react'
import toast from 'react-hot-toast'

import { AXIOM_URL } from '@/lib/axiom'
import { Badge } from '@/components/ui/badge'

import pumpIcon from '@/assets/pump.svg'
import mayhemIcon from '@/assets/mayhem.svg'
import bonkIcon from '@/assets/bonk.svg'
import axiomIcon from '@/assets/axiom.svg'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import {
    CheckCircle2,
    CircleDashed,
    Search,
    Globe,
    Send,
    TriangleAlert,
    Twitter
} from 'lucide-react'

import type { TokenCardModel } from '@/hooks/useSparkTokens'

function safeUrl(u: string) {
    try {
        return new URL(u).toString()
    } catch {
        return ''
    }
}

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

export function TokenRow({ item }: { item: TokenCardModel }) {
    const { token, metadata, metaStatus } = item

    const rawTicker = metadata?.ticker || token.ticker || ''
    const ticker = rawTicker.trim() ? rawTicker.toUpperCase() : 'NA'

    const name = metadata?.name || token.name
    const avatarUrl = metadata?.image_url ? safeUrl(metadata.image_url) : ''

    const links = useMemo(() => {
        return {
            website: metadata?.website ? safeUrl(metadata.website) : '',
            twitter: metadata?.twitter ? safeUrl(metadata.twitter) : '',
            telegram: metadata?.telegram ? safeUrl(metadata.telegram) : '',
            json: token.metadata_url ? safeUrl(token.metadata_url) : ''
        }
    }, [
        metadata?.website,
        metadata?.twitter,
        metadata?.telegram,
        token.metadata_url
    ])

    const protocol = token.protocol
    const proto = protocol ? PROTOCOLS[protocol] : null

    const isMayhem = token.is_mayhem_mode === true

    const protoIcon = protocol === 'pump' && isMayhem ? mayhemIcon : proto?.icon

    const protoTitle =
        protocol === 'pump' && isMayhem ? 'pump.fun (mayhem)' : proto?.title

    const onCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(token.address)
            toast.success('Address successfully copied', { icon: '📋' })
        } catch {
            toast.error('Failed to copy address')
        }
    }

    const MetaIcon =
        metaStatus === 'loading'
            ? CircleDashed
            : metaStatus === 'ready'
              ? CheckCircle2
              : metaStatus === 'error'
                ? TriangleAlert
                : null

    const metaCls =
        metaStatus === 'loading'
            ? 'text-zinc-400'
            : metaStatus === 'ready'
              ? 'text-emerald-300'
              : metaStatus === 'error'
                ? 'text-red-300'
                : 'text-zinc-400'

    const iconLinkCls = 'hover:text-zinc-200 transition-colors'

    return (
        <div
            className={[
                'rounded-xl px-3 py-2',
                'bg-panel',
                'ring-1 ring-line'
            ].join(' ')}
        >
            <div className='flex items-start gap-3'>
                {/* avatar with hover preview */}
                <div className='relative group'>
                    <Avatar className='h-10 w-10 rounded-lg'>
                        <AvatarImage
                            src={avatarUrl}
                            className='rounded-lg object-cover'
                        />
                        <AvatarFallback className='rounded-lg bg-white/5 text-xs'>
                            {ticker.slice(0, 2) || '??'}
                        </AvatarFallback>
                    </Avatar>

                    {avatarUrl && (
                        <div
                            className={[
                                'pointer-events-none',
                                'absolute left-0 top-0 z-50',
                                'opacity-0 scale-95',
                                'group-hover:opacity-100 group-hover:scale-100',
                                'transition duration-150 ease-out',
                                '-translate-y-1 -translate-x-1',
                                'origin-top-left'
                            ].join(' ')}
                        >
                            <div
                                className={[
                                    'h-40 w-40 rounded-xl overflow-hidden',
                                    'ring-1 ring-white/15',
                                    'bg-zinc-950/60 backdrop-blur'
                                ].join(' ')}
                            >
                                <img
                                    src={avatarUrl}
                                    alt={ticker}
                                    className='h-full w-full object-cover'
                                    draggable={false}
                                />
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
                            className={[
                                'font-normal text-muted',
                                'hover:text-muted/80 transition-colors',
                                'cursor-pointer'
                            ].join(' ')}
                            title='Click name to copy address'
                        >
                            {name}
                        </button>
                    </div>

                    <div className='mt-1 flex items-center gap-2 text-zinc-400'>
                        {proto && (
                            <a
                                href={proto.href(token.address)}
                                target='_blank'
                                rel='noreferrer'
                                title={proto.title}
                                className='hover:opacity-80 transition-opacity'
                            >
                                <img
                                    src={protoIcon}
                                    alt={protoTitle}
                                    className='h-4 w-4'
                                    draggable={false}
                                />
                            </a>
                        )}

                        <a
                            href={AXIOM_URL(token.address)}
                            target='_blank'
                            rel='noreferrer'
                            title='View on Axiom'
                            className='hover:opacity-80 transition-opacity'
                        >
                            <img
                                src={axiomIcon}
                                alt='Axiom'
                                className='h-4 w-4'
                                draggable={false}
                            />
                        </a>

                        {links.twitter && (
                            <a
                                href={links.twitter}
                                target='_blank'
                                rel='noreferrer'
                                className='text-[#5dbcff] hover:text-[#5dbcff]/80 transition-colors'
                                title={links.twitter}
                            >
                                <Twitter className='h-4 w-4' />
                            </a>
                        )}

                        {links.website && (
                            <a
                                href={links.website}
                                target='_blank'
                                rel='noreferrer'
                                className={iconLinkCls}
                                title={links.website}
                            >
                                <Globe className='h-4 w-4' />
                            </a>
                        )}

                        {links.telegram && (
                            <a
                                href={links.telegram}
                                target='_blank'
                                rel='noreferrer'
                                className={iconLinkCls}
                                title={links.telegram}
                            >
                                <Send className='h-4 w-4' />
                            </a>
                        )}

                        <a
                            href={`https://x.com/search?q=${token.address}&src=typed_query&f=live`}
                            target='_blank'
                            rel='noreferrer'
                            className={iconLinkCls}
                        >
                            <Search className='h-4 w-4' />
                        </a>

                        {MetaIcon && (
                            <MetaIcon
                                className={[
                                    'h-4 w-4',
                                    metaStatus === 'loading'
                                        ? 'animate-spin'
                                        : '',
                                    metaCls
                                ].join(' ')}
                            />
                        )}

                        <Badge
                            variant='secondary'
                            className={[
                                'ml-1',
                                'h-5 px-2',
                                'text-[11px] tabular-nums',
                                'bg-zinc-900/70 text-zinc-200',
                                'ring-1 ring-white/10'
                            ].join(' ')}
                            title='Dev hold'
                        >
                            DEV {token.devhold}%
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    )
}
