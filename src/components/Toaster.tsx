import { useEffect } from 'react'
import {
    toast,
    Toaster as ToasterComponent,
    useToasterStore
} from 'react-hot-toast'

const MAX_VISIBLE = 3

export default function Toaster() {
    const { toasts } = useToasterStore()

    useEffect(() => {
        const visible = toasts.filter((t) => t.visible)
        if (visible.length <= MAX_VISIBLE) return
        visible.slice(MAX_VISIBLE).forEach((t) => toast.dismiss(t.id))
    }, [toasts])

    return (
        <ToasterComponent
            position='top-center'
            toastOptions={{
                style: {
                    background: '#12141e',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '13px'
                }
            }}
        />
    )
}
