import type { Terminal } from '@/types/liveFeed'

const AXIOM_URL = (address: string) =>
    `https://axiom.trade/t/${address}?chain=sol`

const AXIOM_PAIR_URL = (pair: string) =>
    `https://axiom.trade/meme/${pair}?chain=sol`

const PADRE_URL = (address: string) =>
    `https://trade.padre.gg/trade/solana/${address}`

const GMGN_URL = (address: string) =>
    `https://gmgn.ai/sol/token/${address}`

export function terminalUrl(
    address: string,
    pair: string | null,
    terminal: Terminal
): string {
    switch (terminal) {
        case 'padre': return PADRE_URL(address)
        case 'gmgn': return GMGN_URL(address)
        case 'axiom':
            return pair ? AXIOM_PAIR_URL(pair) : AXIOM_URL(address)
    }
}

export function terminalLink(address: string, terminal: Terminal): string {
    switch (terminal) {
        case 'padre': return PADRE_URL(address)
        case 'gmgn': return GMGN_URL(address)
        case 'axiom':
        default: return AXIOM_URL(address)
    }
}
