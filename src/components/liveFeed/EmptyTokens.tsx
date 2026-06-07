import { Zap } from 'lucide-react'

import { EmptyState } from '@/components/EmptyState'

export function EmptyTokens() {
    return (
        <EmptyState
            icon={<Zap className='size-5' />}
            title='Waiting for the next matched token'
            body='Tune the active preset to broaden or tighten the feed'
        />
    )
}
