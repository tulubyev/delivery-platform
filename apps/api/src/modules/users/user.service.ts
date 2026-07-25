import bcrypt from 'bcryptjs'
import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import type { JwtPayload } from '../../middleware/auth.middleware'

// Роли, которыми может управлять актор (создавать / назначать / редактировать)
const MANAGEABLE_ROLES: Record<string, string[]> = {
  ADMIN:     ['ADMIN', 'ORG_ADMIN', 'SUPERVISOR', 'COURIER', 'CLIENT'],
  ORG_ADMIN: ['SUPERVISOR', 'COURIER', 'CLIENT'],
}

type Actor = Pick<JwtPayload, 'sub' | 'role' | 'organizationId'>

const USER_CARD_SELECT = {
  id: true, name: true, email: true, phone: true, role: true,
  isActive: true, phoneVerified: true, organizationId: true,
  createdAt: true, updatedAt: true,
  organization: { select: { id: true, name: true } },
  courier: { select: { id: true, type: true, vehicleType: true, verificationStatus: true, isOnline: true } },
  client:  { select: { id: true, companyName: true, inn: true } },
} as const

function assignableRoles(actor: Actor): string[] {
  return MANAGEABLE_ROLES[actor.role] ?? []
}

/** Проверяет, что актор вправе управлять юзером с такой ролью/организацией. */
function assertCanManageTarget(actor: Actor, target: { role: string; organizationId: string | null }) {
  if (actor.role === 'ADMIN') return // суперадмин управляет всеми
  if (actor.role === 'ORG_ADMIN') {
    if (!assignableRoles(actor).includes(target.role))
      throw new AppError(403, 'Недостаточно прав для управления этим пользователем')
    if (target.organizationId !== actor.organizationId)
      throw new AppError(403, 'Пользователь принадлежит другой организации')
    return
  }
  throw new AppError(403, 'Недостаточно прав')
}

/** Разрешает и валидирует организацию для целевого юзера. */
function resolveOrganizationId(actor: Actor, role: string, requested?: string | null): string | null {
  if (actor.role === 'ORG_ADMIN') {
    // ORG_ADMIN всегда работает в своей организации
    return actor.organizationId ?? null
  }
  // ADMIN: платформенный ADMIN может быть без организации, остальным роль требует организацию
  if (role === 'ADMIN') return requested ?? null
  return requested ?? null
}

export const userService = {
  async list(actor: Actor, opts: { page: number; limit: number; role?: string; search?: string }) {
    const { page, limit, role, search } = opts
    const where: Record<string, unknown> = {}

    if (actor.role === 'ORG_ADMIN') {
      where.organizationId = actor.organizationId
      // ORG_ADMIN видит только управляемые роли
      where.role = role && assignableRoles(actor).includes(role)
        ? role
        : { in: assignableRoles(actor) }
    } else if (role) {
      where.role = role
    }

    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: USER_CARD_SELECT,
      }),
      prisma.user.count({ where }),
    ])
    return { items, total, page, limit }
  },

  async getById(actor: Actor, id: string) {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_CARD_SELECT })
    if (!user) throw new AppError(404, 'Пользователь не найден')
    assertCanManageTarget(actor, { role: user.role, organizationId: user.organizationId })
    return user
  },

  async create(actor: Actor, dto: {
    name: string; email: string; phone: string; password: string; role: string
    organizationId?: string | null
    companyName?: string | null; inn?: string | null
  }) {
    if (!assignableRoles(actor).includes(dto.role))
      throw new AppError(403, `Вы не можете создавать пользователей с ролью ${dto.role}`)

    const organizationId = resolveOrganizationId(actor, dto.role, dto.organizationId)
    // Не-ADMIN роли обязаны принадлежать организации
    if (dto.role !== 'ADMIN' && !organizationId)
      throw new AppError(400, 'Для этой роли необходимо указать организацию')

    const existing = await prisma.user.findFirst({ where: { OR: [{ email: dto.email }, { phone: dto.phone }] } })
    if (existing) throw new AppError(409, 'Email или телефон уже зарегистрированы')

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name, email: dto.email, phone: dto.phone,
          passwordHash, role: dto.role as never,
          phoneVerified: true, // создан админом — считаем телефон подтверждённым
          isActive: true,
          organizationId,
        },
      })
      // Связанные записи по роли
      if (dto.role === 'COURIER') {
        await tx.courier.create({ data: { userId: user.id, organizationId: organizationId! } })
      } else if (dto.role === 'CLIENT') {
        await tx.client.create({
          data: {
            userId: user.id, organizationId: organizationId!,
            companyName: dto.companyName || null, inn: dto.inn || null,
          },
        })
      }
      return user
    })

    return this.getById(actor, created.id)
  },

  async update(actor: Actor, id: string, dto: {
    name?: string; email?: string; phone?: string; password?: string
    role?: string; isActive?: boolean; organizationId?: string | null
    companyName?: string | null; inn?: string | null
  }) {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, organizationId: true } })
    if (!target) throw new AppError(404, 'Пользователь не найден')
    assertCanManageTarget(actor, target)

    // Смена роли — только в пределах прав актора и не для чужой организации
    let nextRole: string = target.role
    if (dto.role && dto.role !== target.role) {
      if (!assignableRoles(actor).includes(dto.role))
        throw new AppError(403, `Вы не можете назначить роль ${dto.role}`)
      nextRole = dto.role
    }

    // Организация: ADMIN может переносить, ORG_ADMIN — нет
    let nextOrgId = target.organizationId
    if (actor.role === 'ADMIN' && dto.organizationId !== undefined) {
      nextOrgId = dto.organizationId
    }
    if (nextRole !== 'ADMIN' && !nextOrgId)
      throw new AppError(400, 'Для этой роли необходима организация')

    // Уникальность email/phone при смене
    if (dto.email || dto.phone) {
      const clash = await prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [...(dto.email ? [{ email: dto.email }] : []), ...(dto.phone ? [{ phone: dto.phone }] : [])],
        },
        select: { id: true },
      })
      if (clash) throw new AppError(409, 'Email или телефон уже заняты')
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined

    await prisma.user.update({
      where: { id },
      data: {
        ...(dto.name  !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(passwordHash && { passwordHash }),
        role: nextRole as never,
        organizationId: nextOrgId,
      },
    })

    // Синхронизируем карточку клиента (реквизиты), если это CLIENT
    if (nextRole === 'CLIENT' && (dto.companyName !== undefined || dto.inn !== undefined)) {
      await prisma.client.updateMany({
        where: { userId: id },
        data: {
          ...(dto.companyName !== undefined && { companyName: dto.companyName || null }),
          ...(dto.inn !== undefined && { inn: dto.inn || null }),
        },
      })
    }

    return this.getById(actor, id)
  },

  /**
   * Удаление. Если у пользователя есть заказы или журнал аудита — жёсткое удаление
   * невозможно (внешние ключи без каскада), поэтому деактивируем (soft-delete).
   * Иначе удаляем полностью в транзакции.
   */
  async remove(actor: Actor, id: string) {
    if (id === actor.sub) throw new AppError(400, 'Нельзя удалить собственную учётную запись')

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, role: true, organizationId: true,
        courier: { select: { id: true, _count: { select: { orders: true } } } },
        client:  { select: { id: true, _count: { select: { orders: true } } } },
        _count:  { select: { auditLogs: true } },
      },
    })
    if (!target) throw new AppError(404, 'Пользователь не найден')
    assertCanManageTarget(actor, target)

    const hasOrders =
      (target.courier?._count.orders ?? 0) > 0 ||
      (target.client?._count.orders ?? 0) > 0
    const hasAudit = target._count.auditLogs > 0

    if (hasOrders || hasAudit) {
      // Мягкое удаление: сохраняем историю, блокируем вход
      await prisma.user.update({ where: { id }, data: { isActive: false } })
      return { deleted: false, deactivated: true, reason: 'У пользователя есть связанные заказы или журнал — учётная запись деактивирована' }
    }

    // Жёсткое удаление: сначала связанные Courier/Client, затем сам User
    // (refreshTokens и pushSubscriptions удаляются каскадно).
    await prisma.$transaction(async (tx) => {
      if (target.courier) await tx.courier.delete({ where: { id: target.courier.id } })
      if (target.client)  await tx.client.delete({ where: { id: target.client.id } })
      await tx.user.delete({ where: { id } })
    })
    return { deleted: true, deactivated: false }
  },

  /** Список ролей, которые актор вправе назначать (для UI). */
  assignableRolesFor(actor: Actor) {
    return assignableRoles(actor)
  },
}
