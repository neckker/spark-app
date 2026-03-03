import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Download, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type Phase = 'downloading' | 'installing'

export default function Updater() {
    const [progress, setProgress] = useState<number | null>(null)
    const [version, setVersion] = useState('')
    const [phase, setPhase] = useState<Phase>('downloading')

    useEffect(() => {
        async function runUpdate() {
            try {
                const update = await check()
                if (!update) return

                setVersion(update.version)
                setPhase('downloading')

                let downloaded = 0
                let total = 0

                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started':
                            total = event.data.contentLength ?? 0
                            setProgress(0)
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
                            break
                    }
                })

                await relaunch()
            } catch (e) {
                console.error('Updater error:', e)
            }
        }

        runUpdate()
    }, [])

    if (progress === null) return null

    const Icon = phase === 'downloading' ? Download : RotateCw

    return (
        <div
            className={cn(
                'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
                'bg-panel border border-line rounded-xl',
                'px-4 py-3 shadow-xl backdrop-blur-sm',
                'min-w-64 max-w-80',
                'animate-in fade-in slide-in-from-bottom-4 duration-300'
            )}
        >
            <div className='flex items-center gap-2 mb-2'>
                <Icon
                    className={cn(
                        'h-4 w-4 text-accent shrink-0',
                        phase === 'installing' && 'animate-spin'
                    )}
                />
                <span className='text-xs font-medium text-muted'>
                    {phase === 'downloading'
                        ? 'Downloading update'
                        : 'Installing, restarting\u2026'}
                </span>
                {version && (
                    <span className='ml-auto inline-flex items-center h-5 px-1.5 rounded-md bg-accent/15 text-[11px] font-semibold text-accent'>
                        v{version}
                    </span>
                )}
            </div>

            <div className='w-full bg-secondary rounded-full h-1.5 overflow-hidden'>
                <div
                    className='bg-accent h-full rounded-full transition-all duration-300 ease-out'
                    style={{ width: `${progress}%` }}
                />
            </div>

            <p className='mt-1.5 text-right text-[11px] tabular-nums text-muted/60'>
                {progress}%
            </p>
        </div>
    )
}
