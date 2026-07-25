import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ok } from '@delivery/shared'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { userService } from './user.service'

const router: Router = Router()

const ROLE = z.enum(['ADMIN', 'ORG_ADMIN', 'SUPERVISOR', 'COURIER', 'CLIENT'])
const phone = z.string().regex(/^\+7\d{10}$/, 'Телефон в формате +7XXXXXXXXXX')

const CreateUserSchema = z.object({
  name:  z.string().min(2),
  email: z.string().email(),
  phone,
  password: z.string().min(8),
  role: ROLE,
  organizationId: z.string().uuid().nullable().optional(),
  companyName: z.string().optional().nullable(),
  inn: z.string().optional().nullable(),
})

const UpdateUserSchema = z.object({
  name:  z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: phone.optional(),
  password: z.string().min(8).optional(),
  role: ROLE.optional(),
  isActive: z.boolean().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  companyName: z.string().optional().nullable(),
  inn: z.string().optional().nullable(),
})

// Все маршруты доступны только ADMIN и ORG_ADMIN; тонкий скоупинг — в сервисе.
router.use(authenticate, authorize('ADMIN', 'ORG_ADMIN'))

// GET /api/users — список (с пагинацией, фильтром роли и поиском)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1)
    const limit  = Math.min(100, Number(req.query.limit) || 30)
    const role   = req.query.role   as string | undefined
    const search = req.query.search as string | undefined
    res.json(ok(await userService.list(req.user!, { page, limit, role, search })))
  } catch (e) { next(e) }
})

// GET /api/users/meta — какие роли актор вправе назначать (для UI)
router.get('/meta', (req: Request, res: Response) => {
  res.json(ok({ assignableRoles: userService.assignableRolesFor(req.user!) }))
})

// GET /api/users/:id — карточка
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(ok(await userService.getById(req.user!, req.params.id)))
  } catch (e) { next(e) }
})

// POST /api/users — создание
router.post('/', validate(CreateUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(ok(await userService.create(req.user!, req.body)))
  } catch (e) { next(e) }
})

// PATCH /api/users/:id — редактирование
router.patch('/:id', validate(UpdateUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(ok(await userService.update(req.user!, req.params.id, req.body)))
  } catch (e) { next(e) }
})

// DELETE /api/users/:id — удаление (жёсткое либо деактивация при наличии связей)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(ok(await userService.remove(req.user!, req.params.id)))
  } catch (e) { next(e) }
})

export const usersRouter = router
