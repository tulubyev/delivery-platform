import { Router, Request, Response, NextFunction } from 'express'
import { trackingService } from './tracking.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router : Router = Router()

router.get('/online', authenticate, authorize('ADMIN','DISPATCHER'), async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await trackingService.getOnlineCouriers() }) } catch (e) { next(e) }
})
router.get('/courier/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await trackingService.getCourierLocation(req.params.id) }) } catch (e) { next(e) }
})

export { router as trackingRouter }
