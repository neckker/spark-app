import { BellOff } from 'lucide-react'

export default function EmptyTokens() {
    return (
        <div className='flex h-40 items-center justify-center'>
            <div className='flex items-center space-x-2 text-white/80'>
                <BellOff className='h-5 w-5 opacity-80' />
                <span className='text-sm font-medium uppercase'>
                    No notifications
                </span>
            </div>
        </div>
    )
}
