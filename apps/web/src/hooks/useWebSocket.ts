import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../stores/auth.store'
import type { WsServerEvents, WsClientEvents } from '@delivery/shared'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'wss://api.lastmiles.ru/ws'

export function useWebSocket(onMessage: (event: WsServerEvents) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const token = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!token) return
    const ws = new WebSocket(`${WS_URL}?token=${token}`)
    wsRef.current = ws
    ws.onopen = () => console.log('WS connected')
    ws.onclose = () => console.log('WS disconnected')
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch { /* ignore */ } }
    return () => ws.close()
  }, [token]) // eslint-disable-line

  const send = useCallback((event: WsClientEvents) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(event))
  }, [])

  return { send }
}
