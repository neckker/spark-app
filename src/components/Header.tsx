import { useMemo } from 'react'
import { cn } from '@/lib/utils'

import SettingsDialog from '@/components/SettingsDialog'
import { Bolt, Hash, Rss, Settings2, Trash2 } from 'lucide-react'

type PingQuality = 'excellent' | 'good' | 'meh' | 'bad' | 'na'
type PriceStatus = 'idle' | 'loading' | 'ready' | 'error'

function getQuality(pingMs: number | null): PingQuality {
    if (pingMs === null) return 'na'
    if (pingMs <= 50) return 'excellent'
    if (pingMs <= 200) return 'good'
    if (pingMs <= 350) return 'meh'
    return 'bad'
}

function fmtUsd(n: number) {
    if (!Number.isFinite(n)) return '—'
    return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)
}

function Badge({
    icon: Icon,
    text,
    tone = 'neutral',
    title
}: {
    icon: React.ComponentType<{ className?: string }>
    text: React.ReactNode
    tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'sol' | 'count'
    title?: string
}) {
    const toneCls =
        tone === 'good'
            ? 'text-emerald-200 border-emerald-400/25 bg-emerald-400/10'
            : tone === 'warn'
              ? 'text-amber-200 border-amber-400/25 bg-amber-400/10'
              : tone === 'bad'
                ? 'text-rose-200 border-rose-400/25 bg-rose-400/10'
                : tone === 'sol'
                  ? 'text-fuchsia-200 border-fuchsia-400/25 bg-fuchsia-400/10'
                  : tone === 'count'
                    ? 'text-indigo-200 border-indigo-400/25 bg-indigo-400/10'
                    : 'text-zinc-200 border-white/10 bg-white/5'

    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-1.5',
                'h-8 px-2.5 rounded-lg',
                'border',
                'text-xs font-semibold tabular-nums',
                toneCls
            )}
        >
            <Icon className='h-4 w-4 opacity-90' />
            <span className='leading-none'>{text}</span>
        </span>
    )
}

function IconBtn({
    icon: Icon,
    label,
    onClick
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    onClick: () => void
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            aria-label={label}
            title={label}
            className={cn(
                'h-8 w-8 rounded-lg border border-white/10 bg-white/5',
                'grid place-items-center cursor-pointer',
                'hover:bg-white/10 active:bg-white/15',
                'transition-colors'
            )}
        >
            <Icon className='h-4 w-4 text-zinc-100' />
        </button>
    )
}

function TelegramBtn() {
    return (
        <a
            href='https://t.me/neckkero'
            target='_blank'
            rel='noreferrer'
            className={cn(
                'h-8 rounded-lg border border-sky-400/25 bg-sky-400/10',
                'px-3 inline-flex items-center gap-2',
                'text-xs font-semibold text-sky-100',
                'hover:bg-sky-400/15 active:bg-sky-400/20 transition-colors'
            )}
            title='https://t.me/neckkero'
        >
            <span className='inline-block h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.55)]' />
            Telegram
        </a>
    )
}

export default function Header({
    status,
    pingMs,
    solPriceUsd,
    solPriceStatus,
    totalProcessed,
    onClear
}: {
    status: string
    pingMs: number | null
    solPriceUsd: number | null
    solPriceStatus: PriceStatus
    totalProcessed: number
    onClear: () => void
}) {
    const quality = useMemo(() => getQuality(pingMs), [pingMs])

    const pingTone =
        status !== 'open'
            ? status === 'connecting'
                ? 'warn'
                : 'bad'
            : quality === 'excellent'
              ? 'good'
              : quality === 'good'
                ? 'good'
                : quality === 'meh'
                  ? 'warn'
                  : quality === 'bad'
                    ? 'bad'
                    : 'neutral'

    const pingText =
        status !== 'open'
            ? status === 'connecting'
                ? 'Connecting'
                : 'Offline'
            : `${pingMs ?? '0'}ms`

    const solText =
        solPriceStatus === 'ready' && solPriceUsd !== null
            ? `$${fmtUsd(solPriceUsd)}`
            : solPriceStatus === 'loading'
              ? '…'
              : '0.00'

    return (
        <div className='flex items-center gap-2'>
            {/* LEFT: metrics */}
            <div className='flex items-center gap-2'>
                <Badge
                    icon={Rss}
                    text={pingText}
                    tone={pingTone as any}
                    title='WebSocket ping'
                />

                <Badge
                    icon={Bolt}
                    text={solText}
                    tone='sol'
                    title='SOL price (USD), обновляется раз в 30s'
                />

                <Badge
                    icon={Hash}
                    text={totalProcessed}
                    tone='count'
                    title='Total processed tokens'
                />
            </div>

            {/* RIGHT: actions */}
            <div className='ml-auto flex items-center gap-2'>
                <TelegramBtn />

                <SettingsDialog>
                    <IconBtn
                        icon={Settings2}
                        label='Settings'
                        onClick={() => {}}
                    />
                </SettingsDialog>

                <IconBtn icon={Trash2} label='Clear' onClick={onClear} />
            </div>
        </div>
    )
}
