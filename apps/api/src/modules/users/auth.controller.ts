import { Router, Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { validate } from '../../middleware/validate.middleware'
import { authenticate } from '../../middleware/auth.middleware'
import { LoginSchema, RegisterSchema } from '@delivery/shared'
import { z } from 'zod'

const router : Router = Router()
const RefreshSchema    = z.object({ refreshToken: z.string() })
const VerifyOtpSchema  = z.object({ userId: z.string().uuid(), otp: z.string().length(6) })
const ResendOtpSchema  = z.object({ userId: z.string().uuid() })

// POST /auth/register — регистрация (отправляет OTP на телефон)
router.post('/register', validate(RegisterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await authService.register(req.body) }) } catch (e) { next(e) }
})

// POST /auth/verify-phone — подтверждение телефона по OTP → выдаёт токены
router.post('/verify-phone', validate(VerifyOtpSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await authService.verifyPhone(req.body.userId, req.body.otp) }) } catch (e) { next(e) }
})

// POST /auth/resend-otp — повторная отправка OTP
router.post('/resend-otp', validate(ResendOtpSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await authService.resendOtp(req.body.userId) }) } catch (e) { next(e) }
})

// POST /auth/login — вход (только для подтверждённых)
router.post('/login', validate(LoginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await authService.login(req.body) }) } catch (e) { next(e) }
})

// POST /auth/refresh
router.post('/refresh', validate(RefreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await authService.refresh(req.body.refreshToken) }) } catch (e) { next(e) }
})

// POST /auth/logout
router.post('/logout', validate(RefreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { await authService.logout(req.body.refreshToken); res.json({ success: true, data: null }) } catch (e) { next(e) }
})

// GET /auth/me
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: req.user })
})

export { router as authRouter }
