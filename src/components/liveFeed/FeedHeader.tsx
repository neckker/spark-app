import { useMemo, type ReactNode } from 'react'
import {
    Bolt,
    Eye,
    Hash,
    Moon,
    Pause,
    Play,
    Rss,
    Settings2,
    Trash2,
    type LucideIcon
} from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'

import { useTokenAnalyzer } from '@/context/TokenAnalyzerContext'
import { cn } from '@/lib/utils'
import { formatUsdPrice } from '@/lib/format'
import { PRESET_COUNT } from '@/types/liveFeed'
import type { WsStatus } from '@/hooks/useTokenAnalyzer'

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'sol' | 'count'

export function FeedHeader({
    status,
    idle,
    pingMs,
    solPriceUsd,
    totalProcessed,
    enabled,
    onToggle,
    onClear,
    onOpenTrackers,
    onOpenSettings
}: {
    status: WsStatus
    idle: boolean
    pingMs: number | null
    solPriceUsd: number | null
    totalProcessed: number
    enabled: boolean
    onToggle: () => void
    onClear: () => void
    onOpenTrackers: () => void
    onOpenSettings: () => void
}) {
    const {
        config,
        setActivePresetIndex
    } = useTokenAnalyzer()

    const inactive = idle && enabled

    const pingTone = useMemo<Tone>(() => {
        if (inactive) return 'neutral'
        if (status !== 'open') return status === 'connecting' ? 'warn' : 'bad'
        if (pingMs === null) return 'neutral'
        if (pingMs <= 50) return 'good'
        if (pingMs <= 200) return 'good'
        if (pingMs <= 350) return 'warn'
        return 'bad'
    }, [inactive, status, pingMs])

    const pingText = inactive
        ? 'Inactive'
        : status !== 'open'
            ? status === 'connecting' ? 'Connecting' : 'Offline'
            : `${pingMs ?? '0'}ms`

    const solText = solPriceUsd !== null ? `$${formatUsdPrice(solPriceUsd)}` : '0.0'

    return (
        <div className='flex flex-col gap-2.5'>
            <div className='flex items-center gap-2'>
                <Badge
                    icon={inactive ? Moon : Rss}
                    text={pingText}
                    tone={pingTone}
                    title={inactive ? 'Paused - inactive' : 'WebSocket ping'}
                />
                <Badge icon={Bolt} text={solText} tone='sol' title='SOL price (USD)' />
                <Badge icon={Hash} text={totalProcessed} tone='count' title='Total processed tokens' />
                <TelegramBadge className='ml-auto' />
            </div>

            <div className='flex items-center gap-2'>
                <PresetSwitcher
                    active={config.activePresetIndex}
                    onChange={setActivePresetIndex}
                />
                <div className='ml-auto flex items-center gap-2'>
                    <ConnectionToggle
                        enabled={enabled}
                        onToggle={onToggle}
                    />
                    <IconBtn icon={Eye} label='Trackers' onClick={onOpenTrackers} />
                    <IconBtn icon={Settings2} label='Settings' onClick={onOpenSettings} />
                    <IconBtn icon={Trash2} label='Clear feed' onClick={onClear} />
                </div>
            </div>
        </div>
    )
}

// --- internals ---

const TELEGRAM_URL = 'https://t.me/neckkero'

function TelegramBadge({ className }: { className?: string }) {
    return (
        <a
            href={TELEGRAM_URL}
            onClick={(e) => {
                e.preventDefault()
                void openUrl(TELEGRAM_URL)
            }}
            title='Telegram'
            className={cn(
                'inline-flex h-8 items-center rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 text-xs font-semibold text-sky-100 cursor-pointer',
                className
            )}
        >
            @neckkero
        </a>
    )
}

function Badge({
    icon: Icon,
    text,
    tone = 'neutral',
    title
}: {
    icon: LucideIcon
    text: ReactNode
    tone?: Tone
    title?: string
}) {
    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold tabular-nums',
                TONE_CLS[tone]
            )}
        >
            <Icon className='size-4 opacity-90' />
            <span className='leading-none'>{text}</span>
        </span>
    )
}

function IconBtn({
    icon: Icon,
    label,
    onClick
}: {
    icon: LucideIcon
    label: string
    onClick: () => void
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            aria-label={label}
            title={label}
            className='size-8 rounded-lg border border-white/10 bg-white/5 grid place-items-center cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors'
        >
            <Icon className='size-4 text-zinc-100' />
        </button>
    )
}

function ConnectionToggle({
    enabled,
    onToggle
}: {
    enabled: boolean
    onToggle: () => void
}) {
    const Icon = enabled ? Pause : Play
    const label = enabled ? 'Pause feed' : 'Resume feed'

    return (
        <button
            type='button'
            onClick={onToggle}
            aria-label={label}
            title={label}
            className='size-8 rounded-lg border border-white/10 bg-white/5 grid place-items-center cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors'
        >
            <Icon className='size-4 text-zinc-100' />
        </button>
    )
}

function PresetSwitcher({
    active,
    onChange
}: {
    active: number
    onChange: (i: number) => void
}) {
    return (
        <div
            role='radiogroup'
            aria-label='Active preset'
            className='inline-flex items-center gap-3'
        >
            {Array.from({ length: PRESET_COUNT }, (_, i) => {
                const isActive = i === active
                return (
                    <button
                        key={i}
                        type='button'
                        role='radio'
                        aria-checked={isActive}
                        onClick={() => onChange(i)}
                        title={`Preset ${i + 1}`}
                        className={cn(
                            'relative inline-flex h-8 items-center text-xs font-semibold tabular-nums transition-colors cursor-pointer',
                            isActive ? 'text-white' : 'text-muted hover:text-white'
                        )}
                    >
                        P{i + 1}
                        <span
                            aria-hidden
                            className={cn(
                                'absolute inset-x-0 bottom-1.5 h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] origin-center transition-all duration-300 ease-out',
                                isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                            )}
                        />
                    </button>
                )
            })}
        </div>
    )
}

const TONE_CLS: Record<Tone, string> = {
    neutral: 'text-zinc-200 border-white/10 bg-white/5',
    good:    'text-emerald-200 border-emerald-400/25 bg-emerald-400/10',
    warn:    'text-amber-200 border-amber-400/25 bg-amber-400/10',
    bad:     'text-rose-200 border-rose-400/25 bg-rose-400/10',
    sol:     'text-fuchsia-200 border-fuchsia-400/25 bg-fuchsia-400/10',
    count:   'text-indigo-200 border-indigo-400/25 bg-indigo-400/10'
}
