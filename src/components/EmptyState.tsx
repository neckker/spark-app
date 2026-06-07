import type { ReactNode } from 'react'

export function EmptyState({
    icon,
    title,
    body,
    action
}: {
    icon: ReactNode
    title: string
    body?: string
    action?: ReactNode
}) {
    return (
        <div className='flex items-center gap-3 rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-muted sm:p-6'>
            <div className='shrink-0'>{icon}</div>
            <div className='min-w-0 flex-1'>
                <h3 className='text-sm font-semibold text-white/85'>{title}</h3>
                {body && <p className='mt-0.5 text-xs text-muted'>{body}</p>}
            </div>
            {action && <div className='shrink-0'>{action}</div>}
        </div>
    )
}
