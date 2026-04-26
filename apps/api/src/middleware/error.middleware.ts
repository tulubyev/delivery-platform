import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError)
    return res.status(err.statusCode).json({ success: false, error: err.message })
  console.error('Unhandled error:', err)
  return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' })
}
