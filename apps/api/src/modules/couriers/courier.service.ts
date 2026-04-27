import { VerificationStatus } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import { ReviewDocumentsDto, SubmitDocumentsDto } from '@delivery/shared'

export const courierService = {
  async getProfile(userId: string) {
    const courier = await prisma.courier.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    })
    if (!courier) throw new AppError(404, 'Профиль курьера не найден')
    return courier
  },

  async submitDocuments(userId: string, dto: SubmitDocumentsDto) {
    const courier = await prisma.courier.findUnique({ where: { userId } })
    if (!courier) throw new AppError(404, 'Профиль курьера не найден')

    if (courier.verificationStatus === VerificationStatus.APPROVED)
      throw new AppError(409, 'Документы уже верифицированы')

    return prisma.courier.update({
      where: { userId },
      data: {
        passportSeries:      dto.passportSeries,
        passportNumber:      dto.passportNumber,
        passportPhotoUrl:    dto.passportPhotoUrl ?? null,
        innNumber:           dto.innNumber,
        innPhotoUrl:         dto.innPhotoUrl ?? null,
        selfEmployed:        dto.selfEmployed ?? courier.selfEmployed,
        verificationStatus:  VerificationStatus.PENDING,
        verificationComment: null,
      },
    })
  },

  async reviewDocuments(courierId: string, adminUserId: string, dto: ReviewDocumentsDto) {
    const courier = await prisma.courier.findUnique({ where: { id: courierId } })
    if (!courier) throw new AppError(404, 'Курьер не найден')

    if (courier.verificationStatus !== VerificationStatus.PENDING)
      throw new AppError(409, 'Документы не находятся на проверке')

    const status = dto.approve ? VerificationStatus.APPROVED : VerificationStatus.REJECTED

    const updated = await prisma.courier.update({
      where: { id: courierId },
      data: {
        verificationStatus:  status,
        verificationComment: dto.comment ?? null,
        verifiedAt:          dto.approve ? new Date() : null,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId:   adminUserId,
        action:   dto.approve ? 'APPROVE_DOCUMENTS' : 'REJECT_DOCUMENTS',
        entity:   'Courier',
        entityId: courierId,
        diff:     { status, comment: dto.comment ?? null },
      },
    })

    return updated
  },

  async savePushToken(courierId: string, expoPushToken: string) {
    const courier = await prisma.courier.findUnique({ where: { id: courierId } })
    if (!courier) throw new AppError(404, 'Курьер не найден')
    return prisma.courier.update({ where: { id: courierId }, data: { expoPushToken } })
  },

  async list(filters: { verificationStatus?: VerificationStatus; page: number; limit: number }) {
    const { verificationStatus, page, limit } = filters
    const where = verificationStatus ? { verificationStatus } : {}
    const [items, total] = await Promise.all([
      prisma.courier.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.courier.count({ where }),
    ])
    return { items, total, page, limit }
  },
}
