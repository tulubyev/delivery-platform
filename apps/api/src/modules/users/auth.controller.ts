import { Router, Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { validate } from '../../middleware/validate.middleware'
import { authenticate } from '../../middleware/auth.middleware'
import { LoginSchema, RegisterSchema } from '@delivery/shared'
import { z } from 'zod'

const router : Router = Router()
const RefreshSchema = z.object({ refreshToken: z.string() })

router.post('/register', validate(RegisterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await authService.register(req.body) }) } catch (e) { next(e) }
})
router.post('/login', validate(LoginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await authService.login(req.body) }) } catch (e) { next(e) }
})
router.post('/refresh', validate(RefreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await authService.refresh(req.body.refreshToken) }) } catch (e) { next(e) }
})
router.post('/logout', validate(RefreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { await authService.logout(req.body.refreshToken); res.json({ success: true, data: null }) } catch (e) { next(e) }
})
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: req.user })
})

export { router as authRouter }
