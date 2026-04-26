import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import jwt from 'jsonwebtoken'
import { GeoPointSchema, WsClientEvents } from '@delivery/shared'
import { trackingService } from '../tracking/tracking.service'

interface AuthedSocket extends WebSocket { userId?: string; role?: string; subscriptions: Set<string> }

class WsManager {
  private channels = new Map<string, Set<AuthedSocket>>()

  init(wss: WebSocketServer) {
    wss.on('connection', (ws: AuthedSocket, req: IncomingMessage) => {
      ws.subscriptions = new Set()
      const token = new URL(req.url ?? '/', 'http://x').searchParams.get('token')
      if (token) {
        try {
          const p = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; role: string }
          ws.userId = p.sub; ws.role = p.role
        } catch { ws.close(1008, 'Invalid token'); return }
      }

      ws.on('message', async (raw) => {
        try { await this.handle(ws, JSON.parse(raw.toString()) as WsClientEvents) } catch { /* ignore */ }
      })

      ws.on('close', () => {
        ws.subscriptions.forEach((ch) => this.channels.get(ch)?.delete(ws))
        if (ws.role === 'COURIER' && ws.userId) {
          import('../../infrastructure/db/prisma').then(({ prisma }) =>
            prisma.courier.updateMany({ where: { userId: ws.userId }, data: { isOnline: false } }).catch(console.error)
          )
        }
      })
    })
  }

  private async handle(ws: AuthedSocket, event: WsClientEvents) {
    if (event.type === 'SUBSCRIBE_ORDER') this.subscribe(ws, `order:${event.payload.orderId}`)
    else if (event.type === 'SUBSCRIBE_COURIER') this.subscribe(ws, `courier:${event.payload.courierId}`)
    else if (event.type === 'LOCATION_UPDATE' && ws.role === 'COURIER') {
      const p = GeoPointSchema.safeParse(event.payload)
      if (p.success) {
        await trackingService.updateCourierLocation(p.data)
        this.broadcast(`courier:${p.data.courierId}`, { type: 'COURIER_LOCATION', payload: p.data })
      }
    }
  }

  subscribe(ws: AuthedSocket, channel: string) {
    if (!this.channels.has(channel)) this.channels.set(channel, new Set())
    this.channels.get(channel)!.add(ws); ws.subscriptions.add(channel)
  }

  broadcast(channel: string, payload: unknown) {
    const msg = JSON.stringify(payload)
    this.channels.get(channel)?.forEach((ws) => { if (ws.readyState === WebSocket.OPEN) ws.send(msg) })
  }
}

export const wsManager = new WsManager()
