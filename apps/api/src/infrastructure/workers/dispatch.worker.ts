import { Worker, Job } from 'bullmq'
import { createRedisConnection } from '../redis/redis'
import { QUEUE_NAMES, DispatchJobData, DispatchOfferJobData } from '../queue/queues'
import { dispatchService } from '../../modules/dispatch/dispatch.service'

export function startDispatchWorker() {
  const worker = new Worker<DispatchJobData>(
    QUEUE_NAMES.DISPATCH,
    async (job: Job<DispatchJobData>) => {
      const { orderId, organizationId, attempt } = job.data
      await dispatchService.dispatch(orderId, organizationId, attempt)
    },
    {
      connection:  createRedisConnection(),
      concurrency: 10,
    },
  )

  worker.on('failed', (job, err) =>
    console.error(`[DispatchWorker] job ${job?.id} failed:`, err.message),
  )

  console.log('✅ DispatchWorker started')
  return worker
}

export function startOfferExpiryWorker() {
  const worker = new Worker<DispatchOfferJobData>(
    QUEUE_NAMES.DISPATCH_OFFER,
    async (job: Job<DispatchOfferJobData>) => {
      await dispatchService.expireOffer(job.data.offerId)
    },
    {
      connection:  createRedisConnection(),
      concurrency: 20,
    },
  )

  worker.on('failed', (job, err) =>
    console.error(`[OfferExpiryWorker] job ${job?.id} failed:`, err.message),
  )

  console.log('✅ OfferExpiryWorker started')
  return worker
}
