import { Router, Request, Response, NextFunction } from 'express'
import { payoutsService } from './payouts.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { z } from 'zod'

const router : Router = Router()
const CalcSchema = z.object({ courierId: z.string().uuid(), periodStart: z.coerce.date(), periodEnd: z.coerce.date() })

router.get('/', authenticate, authorize('ADMIN','DISPATCHER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await payoutsService.listPayouts(req.query.courierId as string | undefined) }) } catch (e) { next(e) }
})
router.post('/calculate', authenticate, authorize('ADMIN','DISPATCHER'), validate(CalcSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await payoutsService.calculatePayout(req.body.courierId, req.body.periodStart, req.body.periodEnd) }) } catch (e) { next(e) }
})
router.post('/:id/approve', authenticate, authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await payoutsService.approvePayout(req.params.id) }) } catch (e) { next(e) }
})
router.post('/:id/paid', authenticate, authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await payoutsService.markPaid(req.params.id) }) } catch (e) { next(e) }
})

export { router as payoutsRouter }
