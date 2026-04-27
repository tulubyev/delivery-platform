import { AlertSeverity, AlertType } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'

export const alertService = {
  async listAlerts(orgId: string, filters: {
    resolved?: boolean
    type?: AlertType
    severity?: AlertSeverity
    entityType?: string
    page?: number
    limit?: number
  }) {
    const { resolved, type, severity, entityType, page = 1, limit = 50 } = filters
    const where = {
      organizationId: orgId,
      ...(resolved === true  ? { resolvedAt: { not: null } } : {}),
      ...(resolved === false ? { resolvedAt: null }           : {}),
      ...(type       ? { type }       : {}),
      ...(severity   ? { severity }   : {}),
      ...(entityType ? { entityType } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ])
    return { items, total, page, limit }
  },

  async getUnresolvedCount(orgId: string) {
    const counts = await prisma.alert.groupBy({
      by: ['severity'],
      where: { organizationId: orgId, resolvedAt: null },
      _count: true,
    })
    const result: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 }
    for (const row of counts) {
      result[row.severity] = row._count
      result.total += row._count
    }
    return result
  },

  async resolveAlert(alertId: string, orgId: string, resolvedBy: string) {
    const alert = await prisma.alert.findFirst({ where: { id: alertId, organizationId: orgId } })
    if (!alert) throw Object.assign(new Error('Alert not found'), { status: 404 })
    if (alert.resolvedAt) throw Object.assign(new Error('Alert already resolved'), { status: 409 })

    return prisma.alert.update({
      where: { id: alertId },
      data:  { resolvedAt: new Date(), resolvedBy },
    })
  },

  async resolveMany(orgId: string, alertIds: string[], resolvedBy: string) {
    return prisma.alert.updateMany({
      where: { id: { in: alertIds }, organizationId: orgId, resolvedAt: null },
      data:  { resolvedAt: new Date(), resolvedBy },
    })
  },
}
