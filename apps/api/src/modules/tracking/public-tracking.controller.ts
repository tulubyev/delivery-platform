import { Router, Request, Response, NextFunction } from 'express'
import { publicTrackingService } from './public-tracking.service'
import { ok } from '@delivery/shared'

export const publicTrackingRouter: Router = Router()

// No auth — accessible via link sent to recipient
publicTrackingRouter.get(
  '/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await publicTrackingService.getByToken(req.params.token)))
    } catch (e) { next(e) }
  },
)
