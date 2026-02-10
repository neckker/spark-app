import { useMemo } from 'react'
import { useSpark } from '@/hooks/useSpark'

type PingQuality = 'good' | 'ok' | 'bad' | 'na'

function getQuality(pingMs: number | null): PingQuality {
    if (pingMs === null) return 'na'
    if (pingMs <= 80) return 'good'
    if (pingMs <= 200) return 'ok'
    return 'bad'
}

function StatusBadge({ status }: { status: string }) {
    const cls =
        status === 'open'
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            : status === 'connecting'
              ? 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30'
              : status === 'error'
                ? 'bg-red-500/15 text-red-300 ring-red-500/30'
                : 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30'

    return (
        <span
            className={[
                'inline-flex items-center rounded-full px-3 py-1 text-xs',
                'font-medium ring-1',
                cls
            ].join(' ')}
        >
            🔌 {status}
        </span>
    )
}

function PingBadge({ pingMs }: { pingMs: number | null }) {
    const quality = useMemo(() => getQuality(pingMs), [pingMs])

    const cls =
        quality === 'good'
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            : quality === 'ok'
              ? 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30'
              : quality === 'bad'
                ? 'bg-red-500/15 text-red-300 ring-red-500/30'
                : 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30'

    const dot =
        quality === 'good'
            ? 'bg-emerald-400'
            : quality === 'ok'
              ? 'bg-yellow-400'
              : quality === 'bad'
                ? 'bg-red-400'
                : 'bg-zinc-400'

    const label =
        quality === 'good'
            ? 'Good'
            : quality === 'ok'
              ? 'Ok'
              : quality === 'bad'
                ? 'Bad'
                : '—'

    return (
        <span
            className={[
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs',
                'font-medium ring-1',
                cls
            ].join(' ')}
            title='RTT measured on client: ping recv → pong_ack recv'
        >
            <span className={['h-2 w-2 rounded-full', dot].join(' ')} />
            📶 Ping
            <span className='font-semibold tabular-nums'>
                {pingMs ?? '—'} ms
            </span>
            <span className='text-[11px] opacity-80'>{label}</span>
        </span>
    )
}

function App() {
    const { status, pingMs, lastMsgStr, log, clearLog } = useSpark()

    return (
        <div className='min-h-screen bg-zinc-950 text-zinc-100'>
            <div className='mx-auto max-w-5xl p-6'>
                <div className='flex flex-wrap items-center gap-3'>
                    <div className='text-lg font-semibold tracking-tight'>
                        spark
                    </div>

                    <StatusBadge status={status} />
                    <PingBadge pingMs={pingMs} />

                    <button
                        onClick={clearLog}
                        className={[
                            'ml-auto rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium',
                            'ring-1 ring-zinc-800 hover:bg-zinc-800'
                        ].join(' ')}
                    >
                        Clear log
                    </button>
                </div>

                <div className='mt-6 grid gap-4 lg:grid-cols-2'>
                    <div className='rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800'>
                        <div className='px-4 py-3 text-sm font-semibold'>
                            📨 last message
                        </div>
                        <pre className='max-h-90 overflow-auto px-4 pb-4 text-xs leading-relaxed'>
                            <code className='whitespace-pre-wrap wrap-break-word'>
                                {lastMsgStr}
                            </code>
                        </pre>
                    </div>

                    <div className='rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800'>
                        <div className='flex items-center justify-between px-4 py-3'>
                            <div className='text-sm font-semibold'>
                                🗂️ last {log.length} messages
                            </div>
                            <div className='text-xs text-zinc-400'>max 30</div>
                        </div>

                        <div className='max-h-90 overflow-auto px-4 pb-4'>
                            <div className='space-y-2'>
                                {log.length ? (
                                    log.map((s, i) => (
                                        <div
                                            key={i}
                                            className='rounded-xl bg-zinc-950/50 p-3 text-xs ring-1 ring-zinc-800'
                                        >
                                            <code className='whitespace-pre-wrap wrap-break-word'>
                                                {s}
                                            </code>
                                        </div>
                                    ))
                                ) : (
                                    <div className='text-sm text-zinc-400'>
                                        —
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className='mt-4 text-xs text-zinc-500'>
                    Ping — RTT по клиенту (полностью в миллисекундах): получение
                    ping → получение pong_ack.
                </div>
            </div>
        </div>
    )
}

export default App
