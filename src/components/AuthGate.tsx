import type { ComponentType, ReactNode } from 'react'
import { ArrowLeftRight, BookOpen, Crown, Github, Youtube } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { TelegramIcon } from '@/components/icons/TelegramIcon'
import { useAuth } from '@/context/AuthContext'
import { WEB_URL } from '@/config/env'

const DISCORD_URL = 'https://discord.gg/kzpyEHUdpj'
const TELEGRAM_URL = 'https://t.me/neckkero'
const YOUTUBE_URL = 'https://www.youtube.com/@neckkero'
const GITHUB_URL = 'https://github.com/solythbot'

const SOCIALS: {
    label: string
    Icon: ComponentType<{ className?: string }>
    href: string
}[] = [
    { label: 'Documentation', Icon: BookOpen, href: `${WEB_URL}/docs` },
    { label: 'Discord', Icon: DiscordIcon, href: DISCORD_URL },
    { label: 'Telegram', Icon: TelegramIcon, href: TELEGRAM_URL },
    { label: 'YouTube', Icon: Youtube, href: YOUTUBE_URL },
    { label: 'GitHub', Icon: Github, href: GITHUB_URL }
]

export default function AuthGate({ children }: { children: ReactNode }) {
    const { status, connect, logout } = useAuth()

    if (status === 'authenticated') return <>{children}</>

    if (status === 'loading') {
        return (
            <div className='flex min-h-screen items-center justify-center'>
                <Spinner className='size-7 text-white/50' />
            </div>
        )
    }

    return (
        <div className='relative flex min-h-screen flex-col items-center justify-center px-6'>
            <div className='flex flex-col items-center gap-3'>
                <span
                    className='animate-enter text-[13px] font-semibold uppercase tracking-[0.2em] text-white'
                    style={{ animationDelay: '0ms' }}
                >
                    {status === 'needs_premium'
                        ? 'Premium required'
                        : 'Welcome to Spark'}
                </span>

                {status === 'needs_premium' ? (
                    <div
                        className='animate-enter flex items-center gap-2.5'
                        style={{ animationDelay: '80ms' }}
                    >
                        <Button
                            variant='outline'
                            size='lg'
                            onClick={() => void logout()}
                        >
                            <ArrowLeftRight data-icon='inline-start' />
                            Switch account
                        </Button>
                        <Button
                            size='lg'
                            onClick={() => void openUrl(`${WEB_URL}/plans`)}
                        >
                            <Crown data-icon='inline-start' />
                            Upgrade
                        </Button>
                    </div>
                ) : (
                    <button
                        type='button'
                        onClick={() => void connect()}
                        className='animate-enter inline-flex h-10 items-center gap-2 rounded-lg bg-[#5865f2] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#5865f2]/90'
                        style={{ animationDelay: '80ms' }}
                    >
                        <DiscordIcon className='size-4' />
                        Sign in with Discord
                    </button>
                )}
            </div>

            <div
                className='animate-enter absolute inset-x-0 bottom-8 flex items-center justify-center gap-5'
                style={{ animationDelay: '260ms' }}
            >
                {SOCIALS.map(({ label, Icon, href }) => (
                    <button
                        key={label}
                        type='button'
                        aria-label={label}
                        title={label}
                        onClick={() => void openUrl(href)}
                        className='text-muted transition-colors hover:text-white'
                    >
                        <Icon className='size-[18px]' />
                    </button>
                ))}
            </div>
        </div>
    )
}
