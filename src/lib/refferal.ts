import type { Terminal } from '@/context/SettingsContext'

export const AXIOM_URL = (address: string) =>
    `https://axiom.trade/t/${address}/@neckker`

export const AXIOM_PAIR_URL = (pair: string) =>
    `https://axiom.trade/meme/${pair}?chain=sol`

export const PADRE_URL = (address: string) => 
    `https://trade.padre.gg/trade/solana/${address}?rk=neckker`

export const GMGN_URL = (address: string) =>
    `https://gmgn.ai/sol/token/nekky_${address}`


/** Simple address → terminal URL (for icon links in token cards). */
export function terminalLink(address: string, terminal: Terminal): string {
    switch (terminal) {
        case 'padre': return PADRE_URL(address)
        case 'gmgn':  return GMGN_URL(address)
        case 'axiom':
        default:      return AXIOM_URL(address)
    }
}

/** Full terminal URL with pair support (for auto-open). */
export function terminalUrl(address: string, pair: string, terminal: Terminal, mode: string): string {
    switch (terminal) {
        case 'padre':
            return PADRE_URL(address)
        case 'gmgn':
            return GMGN_URL(address)
        case 'axiom':
            if (mode === 'current-tab') {
                return AXIOM_PAIR_URL(pair)
            } else {
                return AXIOM_URL(address)
            }
    }
}
