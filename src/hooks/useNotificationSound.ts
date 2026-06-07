import { useRef, useEffect, useCallback } from 'react'
import notificationSrc from '@/assets/sounds/notification.mp3'

const COOLDOWN_MS = 500

export function useNotificationSound(enabled: boolean, volume: number) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const lastPlayRef = useRef<number>(0)

    useEffect(() => {
        const audio = new Audio(notificationSrc)
        audio.preload = 'auto'
        audioRef.current = audio
        return () => {
            audio.pause()
            audio.src = ''
            audioRef.current = null
        }
    }, [])

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.max(0, Math.min(1, volume / 100))
        }
    }, [volume])

    const play = useCallback(() => {
        if (!enabled) return
        const audio = audioRef.current
        if (!audio) return

        const now = performance.now()
        if (now - lastPlayRef.current < COOLDOWN_MS) return
        lastPlayRef.current = now

        audio.currentTime = 0
        audio.play().catch(() => {})
    }, [enabled])

    return play
}
