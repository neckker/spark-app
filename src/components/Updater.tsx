import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export default function Updater() {
    const [progress, setProgress] = useState<number | null>(null)
    const [status, setStatus] = useState<string>('')

    useEffect(() => {
        async function runUpdate() {
            try {
                const update = await check()
                if (!update) return

                setStatus(`Update ${update.version} found, downloading...`)

                let downloaded = 0
                let total = 0

                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started':
                            total = event.data.contentLength ?? 0
                            setProgress(0)
                            setStatus('Downloading update...')
                            break
                        case 'Progress':
                            downloaded += event.data.chunkLength
                            if (total > 0) {
                                setProgress(Math.round((downloaded / total) * 100))
                            }
                            break
                        case 'Finished':
                            setProgress(100)
                            setStatus('Installing, restarting...')
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

    return (
        <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 shadow-lg text-sm text-white min-w-65'>
            <p className='mb-2 text-zinc-300'>{status}</p>
            <div className='w-full bg-zinc-700 rounded-full h-1.5'>
                <div
                    className='bg-blue-500 h-1.5 rounded-full transition-all duration-300'
                    style={{ width: `${progress}%` }}
                />
            </div>
            <p className='mt-1 text-right text-zinc-400'>{progress}%</p>
        </div>
    )
}
