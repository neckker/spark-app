import type { Terminal } from '@/context/SettingsContext'

export const AXIOM_URL = (address: string) =>
    `https://axiom.trade/t/${address}/@neckker`

export const PADRE_URL = (address: string) => 
    `https://trade.padre.gg/trade/solana/${address}?rk=neckker`

export const GMGN_URL = (address: string) =>
    `https://gmgn.ai/sol/token/nekky_${address}`


export function terminalUrl(address: string, terminal: Terminal): string {
    switch (terminal) {
        case 'padre': return PADRE_URL(address)
        case 'gmgn':  return GMGN_URL(address)
        default:      return AXIOM_URL(address)
    }
}
