import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Download, RotateCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Phase = 'checking' | 'downloading' | 'installing' | 'error'

export default function Updater() {
    const [progress, setProgress] = useState<number | null>(null)
    const [version, setVersion] = useState('')
    const [phase, setPhase] = useState<Phase>('checking')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function runUpdate() {
            try {
                console.log('[Updater] checking for updates...')
                const update = await check()

                if (!update) {
                    console.log('[Updater] no update available (current version is latest)')
                    return
                }

                console.log(`[Updater] update found: v${update.version}`)
                setVersion(update.version)
                setPhase('downloading')

                let downloaded = 0
                let total = 0

                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started':
                            total = event.data.contentLength ?? 0
                            setProgress(0)
                            console.log(`[Updater] download started, size: ${total}`)
                            break
                        case 'Progress':
                            downloaded += event.data.chunkLength
                            if (total > 0) {
                                setProgress(Math.round((downloaded / total) * 100))
                            }
                            break
                        case 'Finished':
                            setProgress(100)
                            setPhase('installing')
                            console.log('[Updater] download finished, installing...')
                            break
                    }
                })

                await relaunch()
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                console.error('[Updater] error:', msg)
                setError(msg)
                setPhase('error')
            }
        }

        runUpdate()
    }, [])

    // Nothing to show - either still checking or no update
    if (phase === 'checking' && progress === null && !error) return null
    if (progress === null && !error) return null

    const Icon =
        phase === 'error'
            ? AlertTriangle
            : phase === 'installing'
                ? RotateCw
                : Download

    return (
        <div
            className={cn(
                'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
                'bg-panel border rounded-xl',
                'px-4 py-3 shadow-xl backdrop-blur-sm',
                'min-w-64 max-w-96',
                'animate-in fade-in slide-in-from-bottom-4 duration-300',
                phase === 'error' ? 'border-destructive/50' : 'border-line'
            )}
        >
            <div className='flex items-center gap-2 mb-2'>
                <Icon
                    className={cn(
                        'h-4 w-4 shrink-0',
                        phase === 'error'
                            ? 'text-destructive'
                            : 'text-accent',
                        phase === 'installing' && 'animate-spin'
                    )}
                />
                <span className={cn(
                    'text-xs font-medium',
                    phase === 'error' ? 'text-destructive' : 'text-muted'
                )}>
                    {phase === 'error'
                        ? 'Update failed'
                        : phase === 'downloading'
                            ? 'Downloading update'
                            : 'Installing, restarting\u2026'}
                </span>
                {version && (
                    <span className='ml-auto inline-flex items-center h-5 px-1.5 rounded-md bg-accent/15 text-[11px] font-semibold text-accent'>
                        v{version}
                    </span>
                )}
            </div>

            {phase === 'error' && error ? (
                <p className='text-[11px] text-muted/80 break-all leading-relaxed'>
                    {error}
                </p>
            ) : (
                <>
                    <div className='w-full bg-secondary rounded-full h-1.5 overflow-hidden'>
                        <div
                            className='bg-accent h-full rounded-full transition-all duration-300 ease-out'
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className='mt-1.5 text-right text-[11px] tabular-nums text-muted/60'>
                        {progress}%
                    </p>
                </>
            )}
        </div>
    )
}
