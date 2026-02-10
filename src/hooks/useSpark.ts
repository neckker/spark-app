import { useEffect, useRef, useState } from 'react'

type WsStatus = 'connecting' | 'open' | 'closed' | 'error'
type WsMessage = Record<string, unknown>

const WS_URL = 'wss://spark.solyth.fun/hub/ws'
const MAX_LOG = 30

export function useSpark() {
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectRef = useRef<number | null>(null)

    const lastPingRecvRef = useRef<number | null>(null)

    const [status, setStatus] = useState<WsStatus>('connecting')
    const [pingMs, setPingMs] = useState<number | null>(null)

    const [lastMsgStr, setLastMsgStr] = useState<string>('—')
    const [log, setLog] = useState<string[]>([])

    const clearReconnect = () => {
        if (reconnectRef.current !== null) {
            window.clearTimeout(reconnectRef.current)
            reconnectRef.current = null
        }
    }

    const connect = (attempt = 0) => {
        clearReconnect()
        setStatus('connecting')

        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => setStatus('open')
        ws.onerror = () => setStatus('error')

        ws.onclose = () => {
            setStatus('closed')

            const base = Math.min(10_000, 500 * 2 ** attempt)
            const jitter = Math.floor(Math.random() * 250)

            reconnectRef.current = window.setTimeout(
                () => connect(attempt + 1),
                base + jitter
            )
        }

        ws.onmessage = evt => {
            if (typeof evt.data !== 'string') return

            let parsed: unknown
            try {
                parsed = JSON.parse(evt.data)
            } catch {
                return
            }

            if (typeof parsed !== 'object' || parsed === null) return
            const msg = parsed as WsMessage

            // ping -> pong (строго как на сервере)
            if (msg.type === 'ping') {
                lastPingRecvRef.current = performance.now()
                ws.send('pong')
                return
            }

            // pong_ack -> RTT (client)
            if (msg.type === 'pong_ack') {
                const t0 = lastPingRecvRef.current
                if (t0 !== null) {
                    setPingMs(Math.round(performance.now() - t0))
                }
                return
            }

            // любые другие события
            const s = JSON.stringify(msg)
            setLastMsgStr(s)
            setLog(prev => [s, ...prev].slice(0, MAX_LOG))
        }
    }

    useEffect(() => {
        connect(0)

        return () => {
            clearReconnect()
            wsRef.current?.close()
            wsRef.current = null
        }
    }, [])

    return {
        status,
        pingMs,
        lastMsgStr,
        log,
        clearLog: () => setLog([])
    }
}
