import { useState } from 'react'

import Toaster from '@/components/Toaster'
import UpdateGate from '@/components/Updater'
import AuthGate from '@/components/AuthGate'

import { useTokenAnalyzer } from '@/hooks/useTokenAnalyzer'
import { useTokenAnalyzer as useAnalyzerCtx } from '@/context/TokenAnalyzerContext'
import { FeedHeader } from '@/components/liveFeed/FeedHeader'
import { SettingsPanel } from '@/components/liveFeed/SettingsPanel'
import { TokenRow } from '@/components/liveFeed/TokenRow'
import { EmptyTokens } from '@/components/liveFeed/EmptyTokens'
import { Trackers } from '@/components/Trackers'

type Page = 'feed' | 'trackers'

function Layout() {
    const {
        status,
        idle,
        pingMs,
        tokens,
        totalProcessed,
        solPriceUsd,
        enabled,
        toggleFeed,
        clearTokens
    } = useTokenAnalyzer()

    const { config } = useAnalyzerCtx()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [page, setPage] = useState<Page>('feed')

    return (
        <div className='min-h-screen text-white'>
            <div style={{ zoom: `${config.app.uiScale}%` }}>
                <div className='mx-auto w-full max-w-lg p-4 space-y-4'>
                    {page === 'feed' ? (
                        <div className='space-y-4'>
                            <FeedHeader
                                status={status}
                                idle={idle}
                                pingMs={pingMs}
                                solPriceUsd={solPriceUsd}
                                totalProcessed={totalProcessed}
                                enabled={enabled}
                                onToggle={toggleFeed}
                                onClear={clearTokens}
                                onOpenTrackers={() => setPage('trackers')}
                                onOpenSettings={() => setSettingsOpen(true)}
                            />

                            {tokens.length === 0 ? (
                                <EmptyTokens />
                            ) : (
                                <ul className='space-y-2.5'>
                                    {tokens.map((item) => (
                                        <li key={item.id}>
                                            <TokenRow
                                                item={item}
                                                solPriceUsd={solPriceUsd}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <Trackers onBack={() => setPage('feed')} />
                    )}
                </div>
            </div>

            <SettingsPanel
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />

            <Toaster />
        </div>
    )
}

export default function App() {
    return (
        <UpdateGate>
            <AuthGate>
                <Layout />
            </AuthGate>
        </UpdateGate>
    )
}
