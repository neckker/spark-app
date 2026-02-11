import { useMemo, useState } from 'react'

import pumpIcon from '@/assets/pump.svg'
import mayhemIcon from '@/assets/mayhem.svg'
import bonkIcon from '@/assets/bonk.svg'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import {
    CheckCircle2,
    CircleDashed,
    // FileJson2,
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

function fmtDevhold(v: number) {
    if (!Number.isFinite(v)) return '—'
    const s = v
        .toFixed(v < 10 ? 2 : 1)
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1')
    return `${s}%`
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
    const [copied, setCopied] = useState(false)

    const rawTicker = metadata?.ticker || token.ticker || ''
    const ticker = rawTicker.trim()
        ? rawTicker.toUpperCase()
        : 'N/A'

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

    const protoIcon =
        protocol === 'pump' && isMayhem
            ? mayhemIcon
            : proto?.icon

    const protoTitle =
        protocol === 'pump' && isMayhem
            ? 'pump.fun (mayhem)'
            : proto?.title

    const onCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(token.address)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 700)
        } catch {
            // ignore
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
                <Avatar className='h-10 w-10 rounded-lg'>
                    <AvatarImage
                        src={avatarUrl}
                        className='rounded-lg object-cover'
                    />
                    <AvatarFallback className='rounded-lg bg-white/5 text-xs'>
                        {ticker.slice(0, 2) || '??'}
                    </AvatarFallback>
                </Avatar>

                <div className='min-w-0 flex-1'>
                    {/* top row: title + devhold */}
                    <div className='flex items-start gap-2'>
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
                                {copied ? '✅ copied' : name}
                            </button>
                        </div>

                        <div className='shrink-0 text-[11px] tabular-nums text-zinc-300'>
                            🧪 {fmtDevhold(token.devhold)}
                        </div>
                    </div>

                    {/* icons row: socials -> json -> meta status (one row) */}
                    <div className='mt-1 flex items-center gap-2 text-zinc-400'>
                        {proto && (
                            <a
                                href={proto.href(token.address)}
                                target='_blank'
                                rel='noreferrer'
                                title={proto.title}
                                className='hover:opacity-90 transition-opacity'
                            >
                                <img
                                    src={protoIcon}
                                    alt={protoTitle}
                                    className='h-4 w-4'
                                    draggable={false}
                                />
                            </a>
                        )}

                        {links.twitter && (
                            <a
                                href={links.twitter}
                                target='_blank'
                                rel='noreferrer'
                                className={iconLinkCls}
                                title='Twitter'
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
                                title='Website'
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
                                title='Telegram'
                            >
                                <Send className='h-4 w-4' />
                            </a>
                        )}

                        {/* {links.json && (
                            <a
                                href={links.json}
                                target='_blank'
                                rel='noreferrer'
                                className={iconLinkCls}
                                title='Metadata JSON'
                            >
                                <FileJson2 className='h-4 w-4' />
                            </a>
                        )} */}

                        {MetaIcon && (
                            <MetaIcon
                                className={[
                                    'h-4 w-4',
                                    metaStatus === 'loading' ? 'animate-spin' : '',
                                    metaCls
                                ].join(' ')}
                            />
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}
