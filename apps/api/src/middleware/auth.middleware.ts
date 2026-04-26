import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtPayload { sub: string; role: string; email: string; organizationId?: string }

declare global {
  namespace Express {
    interface Request { user?: JwtPayload }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Токен не предоставлен' })
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as JwtPayload
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Токен недействителен или истёк' })
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Не аутентифицирован' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, error: 'Недостаточно прав' })
    next()
  }
}
