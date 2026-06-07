import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            data-slot='input'
            className={cn(
                'h-9 w-full min-w-0 rounded-md px-3 py-1 text-sm text-white outline-none transition-colors',
                'bg-secondary border border-lightline placeholder:text-muted',
                'selection:bg-primary selection:text-white',
                'aria-invalid:border-destructive',
                'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

export { Input }
