import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success)
      return res.status(422).json({ success: false, error: 'Ошибка валидации', details: result.error.flatten().fieldErrors })
    req.body = result.data
    next()
  }
}
