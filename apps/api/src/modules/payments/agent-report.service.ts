import { AgentReportStatus, PaymentStatus } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'

export const agentReportService = {
  // Сформировать отчёт агента за период
  async generate(organizationId: string, periodStart: Date, periodEnd: Date) {
    // Проверяем что за этот период нет отчёта
    const exists = await prisma.agentReport.findFirst({
      where: { organizationId, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd }, status: { not: AgentReportStatus.DRAFT } },
    })
    if (exists) throw Object.assign(new Error('Report for this period already exists'), { status: 409 })

    // Берём все успешные платежи за период
    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        status:    PaymentStatus.SUCCEEDED,
        capturedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { id: true, amount: true, commissionAmount: true, principalAmount: true },
    })

    if (!payments.length) throw Object.assign(new Error('No succeeded payments in this period'), { status: 400 })

    const totalAmount   = payments.reduce((s, p) => s + p.amount, 0)
    const commissionAmt = payments.reduce((s, p) => s + p.commissionAmount, 0)
    const principalAmt  = payments.reduce((s, p) => s + p.principalAmount, 0)

    const cfg = await prisma.tenantConfig.findUnique({ where: { organizationId }, select: { agentCommissionPct: true } })

    return prisma.$transaction(async tx => {
      const report = await tx.agentReport.create({
        data: {
          organizationId,
          periodStart,
          periodEnd,
          paymentsCount: payments.length,
          totalAmount,
          commissionAmt,
          principalAmt,
          commissionPct: cfg?.agentCommissionPct ?? 5.0,
          status:        AgentReportStatus.DRAFT,
          items: {
            create: payments.map(p => ({
              paymentId:    p.id,
              amount:       p.amount,
              commissionAmt: p.commissionAmount,
              principalAmt:  p.principalAmount,
            })),
          },
        },
        include: { items: true },
      })
      return report
    })
  },

  async list(organizationId: string) {
    return prisma.agentReport.findMany({
      where:   { organizationId },
      orderBy: { periodStart: 'desc' },
      select:  { id: true, periodStart: true, periodEnd: true, paymentsCount: true, totalAmount: true, commissionAmt: true, principalAmt: true, commissionPct: true, status: true, sentAt: true, createdAt: true },
    })
  },

  async get(id: string, organizationId: string) {
    const report = await prisma.agentReport.findFirst({
      where:   { id, organizationId },
      include: {
        items: {
          include: { payment: { select: { orderId: true, amount: true, capturedAt: true, yookassaId: true } } },
        },
      },
    })
    if (!report) throw Object.assign(new Error('Report not found'), { status: 404 })
    return report
  },

  // Экспорт в CSV для бухгалтерии
  async exportCsv(id: string, organizationId: string): Promise<string> {
    const report = await this.get(id, organizationId)
    const org    = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } })

    const lines: string[] = [
      `"Отчёт агента"`,
      `"Принципал:","${org?.name ?? ''}"`,
      `"Период:","${report.periodStart.toLocaleDateString('ru')} — ${report.periodEnd.toLocaleDateString('ru')}"`,
      `"Агентское вознаграждение:","${report.commissionPct}%"`,
      ``,
      `"№","ID платежа YooKassa","ID заказа","Дата оплаты","Сумма","Вознаграждение агента","К перечислению принципалу"`,
    ]

    report.items.forEach((item, i) => {
      const date = item.payment.capturedAt?.toLocaleDateString('ru') ?? ''
      lines.push(
        `"${i + 1}","${item.payment.yookassaId ?? ''}","${item.payment.orderId}","${date}","${item.amount.toFixed(2)}","${item.commissionAmt.toFixed(2)}","${item.principalAmt.toFixed(2)}"`,
      )
    })

    lines.push(``)
    lines.push(`"ИТОГО","","","","${report.totalAmount.toFixed(2)}","${report.commissionAmt.toFixed(2)}","${report.principalAmt.toFixed(2)}"`)

    return lines.join('\n')
  },

  async markSent(id: string, organizationId: string) {
    const report = await prisma.agentReport.findFirst({ where: { id, organizationId } })
    if (!report) throw Object.assign(new Error('Report not found'), { status: 404 })
    return prisma.agentReport.update({
      where: { id },
      data:  { status: AgentReportStatus.SENT, sentAt: new Date() },
    })
  },

  // Сводка по периоду для дашборда
  async summary(organizationId: string, from: Date, to: Date) {
    const [succeeded, pending, total] = await Promise.all([
      prisma.payment.aggregate({ where: { organizationId, status: PaymentStatus.SUCCEEDED, capturedAt: { gte: from, lte: to } }, _sum: { amount: true, commissionAmount: true, principalAmount: true }, _count: true }),
      prisma.payment.count({ where: { organizationId, status: PaymentStatus.PENDING } }),
      prisma.payment.count({ where: { organizationId, createdAt: { gte: from, lte: to } } }),
    ])
    return {
      succeeded:      succeeded._count,
      pending,
      totalPayments:  total,
      revenue:        succeeded._sum.amount ?? 0,
      commission:     succeeded._sum.commissionAmount ?? 0,
      toPrincipal:    succeeded._sum.principalAmount ?? 0,
    }
  },
}
