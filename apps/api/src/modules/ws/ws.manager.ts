import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import jwt from 'jsonwebtoken'
import { GeoPointSchema, WsClientEvents } from '@delivery/shared'
import { trackingService } from '../tracking/tracking.service'
import { createRedisConnection } from '../../infrastructure/redis/redis'

interface AuthedSocket extends WebSocket { userId?: string; role?: string; organizationId?: string; subscriptions: Set<string> }

class WsManager {
  private channels = new Map<string, Set<AuthedSocket>>()
  private subscriber = createRedisConnection()

  init(wss: WebSocketServer) {
    // Forward Redis pub/sub messages to WS subscribers
    this.subscriber.on('message', (channel: string, message: string) => {
      this.broadcast(channel, JSON.parse(message))
    })

    wss.on('connection', (ws: AuthedSocket, req: IncomingMessage) => {
      ws.subscriptions = new Set()
      const token = new URL(req.url ?? '/', 'http://x').searchParams.get('token')
      if (token) {
        try {
          const p = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; role: string; organizationId?: string }
          ws.userId = p.sub; ws.role = p.role; ws.organizationId = p.organizationId
        } catch { ws.close(1008, 'Invalid token'); return }
      }

      ws.on('message', async (raw) => {
        try { await this.handle(ws, JSON.parse(raw.toString()) as WsClientEvents) } catch { /* ignore */ }
      })

      ws.on('close', () => {
        ws.subscriptions.forEach((ch) => {
          const set = this.channels.get(ch)
          set?.delete(ws)
          // Unsubscribe from Redis when no more WS clients on channel
          if (set?.size === 0) {
            this.channels.delete(ch)
            this.subscriber.unsubscribe(ch).catch(console.error)
          }
        })
        if (ws.role === 'COURIER' && ws.userId) {
          import('../../infrastructure/db/prisma').then(({ prisma }) =>
            prisma.courier.updateMany({ where: { userId: ws.userId }, data: { isOnline: false } }).catch(console.error)
          )
        }
      })
    })
  }

  private async handle(ws: AuthedSocket, event: WsClientEvents) {
    if (event.type === 'SUBSCRIBE_ORDER') {
      this.subscribe(ws, `order:${event.payload.orderId}`)
    } else if (event.type === 'SUBSCRIBE_COURIER') {
      this.subscribe(ws, `courier:${event.payload.courierId}`)
    } else if (event.type === 'SUBSCRIBE_ORG' && ws.organizationId) {
      // Supervisor subscribes to all org-level events (new alerts, order updates)
      this.subscribe(ws, `org:${ws.organizationId}`)
    } else if (event.type === 'LOCATION_UPDATE' && ws.role === 'COURIER') {
      const p = GeoPointSchema.safeParse(event.payload)
      if (p.success) {
        await trackingService.updateCourierLocation(p.data)
        // No manual broadcast — Redis PUBLISH in updateCourierLocation triggers it via subscriber
      }
    }
  }

  subscribe(ws: AuthedSocket, channel: string) {
    const isNew = !this.channels.has(channel) || this.channels.get(channel)!.size === 0
    if (!this.channels.has(channel)) this.channels.set(channel, new Set())
    this.channels.get(channel)!.add(ws)
    ws.subscriptions.add(channel)
    // Subscribe to Redis channel only once
    if (isNew) this.subscriber.subscribe(channel).catch(console.error)
  }

  broadcast(channel: string, payload: unknown) {
    const msg = JSON.stringify(payload)
    this.channels.get(channel)?.forEach((ws) => { if (ws.readyState === WebSocket.OPEN) ws.send(msg) })
  }

  // Publish org-level events (alerts, status changes) for supervisor dashboard
  publishToOrg(orgId: string, payload: unknown) {
    import('../../infrastructure/redis/redis').then(({ redis }) =>
      redis.publish(`org:${orgId}`, JSON.stringify(payload)).catch(console.error)
    )
  }
}

export const wsManager = new WsManager()
