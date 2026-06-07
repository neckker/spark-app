import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'

import { terminalUrl } from '@/lib/liveFeedTerminals'
import type { Terminal } from '@/types/liveFeed'

export function useTokenOpener() {
    return useCallback(
        async (address: string, pair: string | null, terminal: Terminal) => {
            const url = terminalUrl(address, pair, terminal)
            const delivered = await invoke<boolean>('set_open_url', { url })
            if (!delivered) await openUrl(url)
        },
        []
    )
}
