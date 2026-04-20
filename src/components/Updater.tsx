import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Download, RotateCw } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type Phase = 'checking' | 'ready' | 'downloading' | 'installing' | 'error'

// Верхняя граница на первичный опрос апдейтера. Плагин обращается к GitHub
// за манифестом; при недоступной сети / медленном DNS / ратлимите запрос
// может висеть минутами и держит юзера на спиннере. Если не уложились —
// считаем, что апдейта нет, и пропускаем вниз к license gate.
const CHECK_TIMEOUT_MS = 10_000

export default function UpdateGate({ children }: { children: React.ReactNode }) {
    const [progress, setProgress] = useState<number | null>(null)
    const [version, setVersion] = useState('')
    const [phase, setPhase] = useState<Phase>('checking')

    useEffect(() => {
        async function runUpdate() {
            try {
                console.log('[Updater] checking for updates...')
                const update = await Promise.race([
                    check(),
                    new Promise<null>((_, reject) =>
                        setTimeout(
                            () => reject(new Error('update check timeout')),
                            CHECK_TIMEOUT_MS,
                        ),
                    ),
                ])

                if (!update) {
                    console.log('[Updater] no update available (current version is latest)')
                    setPhase('ready')
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
                setPhase('error')
            }
        }

        runUpdate()
    }, [])

    // Checking — show spinner
    if (phase === 'checking') {
        return (
            <div className='min-h-screen bg-main flex items-center justify-center'>
                <Spinner className='h-6 w-6 text-zinc-400' />
            </div>
        )
    }

    // No update or check failed — pass through to children (license gate)
    if (phase === 'ready' || phase === 'error') {
        return <>{children}</>
    }

    // Downloading / installing — show update UI
    const Icon = phase === 'installing' ? RotateCw : Download

    return (
        <div className='min-h-screen bg-main flex items-center justify-center p-6'>
            <div className='w-full max-w-sm space-y-4'>
                <div className='flex flex-col items-center gap-3 text-center'>
                    <div className='h-14 w-14 rounded-2xl flex items-center justify-center bg-white/5 ring-1 ring-white/10'>
                        <Icon className={cn('h-7 w-7 text-accent', phase === 'installing' && 'animate-spin')} />
                    </div>
                    <div>
                        <h1 className='text-lg font-semibold text-white'>
                            {phase === 'installing' ? 'Installing Update' : 'Downloading Update'}
                        </h1>
                        <p className='mt-1 text-sm text-muted'>
                            {phase === 'installing'
                                ? 'Restarting the app…'
                                : 'A new version is available and will be installed automatically.'}
                        </p>
                    </div>
                    {version && (
                        <span className='inline-flex items-center h-6 px-2 rounded-md bg-accent/15 text-xs font-semibold text-accent'>
                            v{version}
                        </span>
                    )}
                </div>

                <div className='space-y-2'>
                    <div className='w-full bg-secondary rounded-full h-2 overflow-hidden'>
                        <div
                            className='bg-accent h-full rounded-full transition-all duration-300 ease-out'
                            style={{ width: `${progress ?? 0}%` }}
                        />
                    </div>
                    <p className='text-right text-xs tabular-nums text-muted/60'>
                        {progress ?? 0}%
                    </p>
                </div>
            </div>
        </div>
    )
}
