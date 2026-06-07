export function formatAge(ts: number): string {
    if (!ts) return ''
    const diff = Math.max(0, Date.now() - ts)
    const s = Math.floor(diff / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d`
    const mo = Math.floor(d / 30)
    if (mo < 12) return `${mo}mo`
    const y = Math.floor(d / 365)
    return `${y}y`
}

export function formatUsdCompact(usd: number): string {
    if (!Number.isFinite(usd) || usd <= 0) return '0.0'
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
    if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(1)}k`
    return `$${usd.toFixed(0)}`
}

export function formatUsdPrice(usd: number): string {
    if (!Number.isFinite(usd)) return '0.0'
    return usd >= 100 ? usd.toFixed(0) : usd >= 10 ? usd.toFixed(1) : usd.toFixed(2)
}

export function shortAddress(addr: string, head = 4, tail = 4): string {
    if (!addr) return ''
    if (addr.length <= head + tail + 3) return addr
    return `${addr.slice(0, head)}...${addr.slice(-tail)}`
}
