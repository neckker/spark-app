import { useMemo } from 'react'
import { Plug2, PlugZap, Rss } from 'lucide-react'

import { useSparkTokens } from '@/hooks/useSparkTokens'
import { TokenRow } from '@/components/TokenRow'

type PingQuality = 'excellent' | 'good' | 'meh' | 'bad' | 'na'

function getQuality(pingMs: number | null): PingQuality {
    if (pingMs === null) return 'na'
    if (pingMs <= 50) return 'excellent'
    if (pingMs <= 200) return 'good'
    if (pingMs <= 350) return 'meh'
    return 'bad'
}

function ConnPill({
    status,
    pingMs
}: {
    status: string
    pingMs: number | null
}) {
    const quality = useMemo(() => getQuality(pingMs), [pingMs])

    if (status !== 'open') {
        const cls =
            status === 'connecting'
                ? 'bg-yellow-400/15 text-yellow-200 ring-yellow-400/20'
                : 'bg-red-400/15 text-red-200 ring-red-400/20'

        const Icon = status === 'connecting' ? PlugZap : Plug2
        const label = status === 'connecting' ? 'Connecting…' : 'Disconnected'

        return (
            <span
                className={[
                    'inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs',
                    'font-medium ring-1 whitespace-nowrap',
                    cls
                ].join(' ')}
            >
                <Icon className='h-4 w-4 opacity-90' />
                {label}
            </span>
        )
    }

    const cls =
        quality === 'excellent'
            ? 'bg-green-400/15 text-green-200 ring-green-400/30'
            : quality === 'good'
              ? 'bg-green-400/15 text-green-200 ring-green-400/20'
              : quality === 'meh'
                ? 'bg-yellow-400/15 text-yellow-200 ring-yellow-400/20'
                : quality === 'bad'
                  ? 'bg-red-400/15 text-red-200 ring-red-400/20'
                  : 'bg-white/10 text-zinc-200 ring-white/15'

    const label =
        quality === 'excellent'
            ? 'Excellent'
            : quality === 'good'
              ? 'Good'
              : quality === 'meh'
                ? 'Meh'
                : quality === 'bad'
                  ? 'Bad'
                  : '—'

    return (
        <span
            className={[
                'inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs',
                'font-medium ring-1 whitespace-nowrap',
                cls
            ].join(' ')}
            title='RTT: ping recv → pong_ack recv'
        >
            <Rss className='h-4 w-4 opacity-90' />
            {pingMs ?? '—'} ms <span className='opacity-80'>{label}</span>
        </span>
    )
}

export default function App() {
    const { status, pingMs, tokens, totalProcessed, clearTokens } =
        useSparkTokens()

    return (
        <div className='min-h-screen bg-main text-zinc-100'>
            <div className='mx-auto w-full max-w-115 p-4'>
                <div className='flex items-center gap-2'>
                    <ConnPill status={status} pingMs={pingMs} />

                    <div className='ml-auto flex items-center gap-3 text-xs text-zinc-300'>
                        <span title='Total processed tokens'>
                            🧾 {totalProcessed}
                        </span>

                        <button
                            onClick={clearTokens}
                            className='rounded-md bg-white/10 px-3 py-1 text-xs ring-1 ring-white/10 hover:bg-white/15'
                        >
                            Clear
                        </button>
                    </div>
                </div>

                <div className='mt-3 space-y-2'>
                    {tokens.length ? (
                        tokens.map(item => <TokenRow key={item.id} item={item} />)
                    ) : (
                        <div className='rounded-xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10'>
                            — waiting for tokens…
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
