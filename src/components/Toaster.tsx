import React, { useEffect } from 'react'
import toast, { Toaster as ToasterComponent, useToasterStore } from 'react-hot-toast'


interface ToasterProps {
    maxCount?: number
}


const Toaster: React.FC<ToasterProps> = ({ maxCount = 3 }) => {
    const { toasts } = useToasterStore()

    useEffect(() => {
        toasts
            .filter((t) => t.visible)
            .filter((_, i) => i >= maxCount)
            .forEach((t) => toast.dismiss(t.id))
    }, [toasts, maxCount])

    return (
        <ToasterComponent
            toastOptions={{
                duration: 3000,
                style: {
                    background: '#292c3a',
                    color: '#fff',
                    border: '1px solid #3c434d',
                    alignItems: 'center'
                },
            }}
        />
    )
}

export default Toaster
