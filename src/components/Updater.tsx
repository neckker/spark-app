import { useEffect, useState, type ReactNode } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

import { Spinner } from '@/components/ui/spinner'

type Phase = 'checking' | 'ready' | 'downloading' | 'installing' | 'error'

const CHECK_TIMEOUT_MS = 10_000

export default function UpdateGate({ children }: { children: ReactNode }) {
    const [progress, setProgress] = useState<number | null>(null)
    const [version, setVersion] = useState('')
    const [phase, setPhase] = useState<Phase>('checking')

    useEffect(() => {
        async function runUpdate() {
            try {
                const update = await Promise.race([
                    check(),
                    new Promise<null>((_, reject) =>
                        setTimeout(
                            () => reject(new Error('update check timeout')),
                            CHECK_TIMEOUT_MS
                        )
                    )
                ])

                if (!update) {
                    setPhase('ready')
                    return
                }

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
            } catch {
                setPhase('error')
            }
        }

        runUpdate()
    }, [])

    if (phase === 'checking') {
        return (
            <div className='flex min-h-screen items-center justify-center'>
                <Spinner className='size-7 text-white/50' />
            </div>
        )
    }

    if (phase === 'ready' || phase === 'error') {
        return <>{children}</>
    }

    return (
        <div className='flex min-h-screen items-center justify-center px-6'>
            <div className='w-full max-w-xs rounded-2xl border border-line bg-panel/70 p-6 text-center backdrop-blur-sm'>
                <h1 className='text-base font-semibold text-white'>
                    {phase === 'installing'
                        ? 'Installing update'
                        : 'Downloading update'}
                </h1>
                <p className='mt-1.5 text-sm text-muted'>
                    {phase === 'installing'
                        ? 'Restarting the app…'
                        : 'A new version is downloading automatically.'}
                </p>
                {version && (
                    <span className='mt-3 inline-flex h-6 items-center rounded-md bg-accent/15 px-2 text-xs font-semibold text-accent'>
                        v{version}
                    </span>
                )}

                <div className='mt-5 space-y-2'>
                    <div className='h-2 w-full overflow-hidden rounded-full bg-secondary'>
                        <div
                            className='h-full rounded-full bg-accent transition-all duration-300 ease-out'
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
