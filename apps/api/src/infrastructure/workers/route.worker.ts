import { Worker, Queue } from 'bullmq'
import { createRedisConnection } from '../redis/redis'
import { QUEUE_NAMES } from '../queue/queues'
import { routeService } from '../../modules/routes/route.service'

export function startRouteWorker() {
  const worker = new Worker(
    QUEUE_NAMES.ROUTE_BUILD,
    async (job) => {
      const { courierId } = job.data as { courierId: string }
      const route = await routeService.buildRoute(courierId)
      if (route) console.log(`[RouteWorker] built route ${route.id} for courier ${courierId}, ${route.stops.length} stops`)
    },
    { connection: createRedisConnection(), concurrency: 5 },
  )

  worker.on('failed', (_job, err) => console.error('[RouteWorker] failed:', err.message))
  console.log('✅ RouteWorker started')
  return worker
}
