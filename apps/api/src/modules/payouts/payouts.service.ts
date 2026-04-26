import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import { PayoutStatus } from '@prisma/client'

export const payoutsService = {
  async calculatePayout(courierId: string, periodStart: Date, periodEnd: Date) {
    const courier = await prisma.courier.findUnique({ where: { id: courierId } })
    if (!courier) throw new AppError(404, 'Курьер не найден')
    const rule = await prisma.payoutRule.findFirst({ where: { isDefault: true } })
    if (!rule) throw new AppError(500, 'Не настроено правило выплат')

    const orders = await prisma.order.findMany({ where: { courierId, status: 'DELIVERED', deliveredAt: { gte: periodStart, lte: periodEnd } } })
    const ordersCount = orders.length
    const baseAmount = ordersCount * rule.baseRate
    const lateOrders = orders.filter((o) => o.deadlineAt && o.deliveredAt && o.deliveredAt > o.deadlineAt)
    const penaltyAmount = lateOrders.length * rule.penaltyPerLate
    const bonusAmount = (baseAmount * rule.bonusPercentage) / 100
    const totalAmount = baseAmount + bonusAmount - penaltyAmount

    return prisma.payout.create({ data: { courierId, ruleId: rule.id, periodStart, periodEnd, ordersCount, baseAmount, bonusAmount, penaltyAmount, totalAmount, status: PayoutStatus.CALCULATED } })
  },

  listPayouts: (courierId?: string) =>
    prisma.payout.findMany({ where: courierId ? { courierId } : undefined, orderBy: { createdAt: 'desc' }, include: { courier: { include: { user: { select: { name: true } } } } } }),

  async approvePayout(id: string) {
    const p = await prisma.payout.findUnique({ where: { id } })
    if (!p) throw new AppError(404, 'Выплата не найдена')
    if (p.status !== PayoutStatus.CALCULATED) throw new AppError(400, 'Нельзя подтвердить')
    return prisma.payout.update({ where: { id }, data: { status: PayoutStatus.APPROVED } })
  },

  markPaid: (id: string) => prisma.payout.update({ where: { id }, data: { status: PayoutStatus.PAID, paidAt: new Date() } }),
}
