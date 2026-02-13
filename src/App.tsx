import Header from '@/components/Header'
import Toaster from '@/components/Toaster'

import { TokenRow } from '@/components/TokenRow'
import EmptyTokens from '@/components/EmptyTokens'

import LicenseGate from '@/components/LicenseGate'
import { useSparkTokens } from '@/hooks/useSparkTokens'

function Layout() {
    const {
        status,
        pingMs,
        tokens,
        totalProcessed,
        clearTokens,
        solPriceUsd,
        solPriceStatus
    } = useSparkTokens()

    return (
        <div className='min-h-screen bg-main text-white'>
            <div className='mx-auto w-full max-w-lg p-4'>
                <Header
                    status={status}
                    pingMs={pingMs}
                    solPriceUsd={solPriceUsd}
                    solPriceStatus={solPriceStatus}
                    totalProcessed={totalProcessed}
                    onClear={clearTokens}
                />

                <div className='mt-6 space-y-2.5'>
                    {tokens.length ? (
                        tokens.map(item => (
                            <TokenRow
                                key={item.id}
                                item={item}
                                solPriceUsd={solPriceUsd}
                            />
                        ))
                    ) : (
                        <EmptyTokens />
                    )}
                </div>
            </div>

            <Toaster />
        </div>
    )
}

export default function App() {
    return (
        <LicenseGate>
            <Layout />
        </LicenseGate>
    )
}
