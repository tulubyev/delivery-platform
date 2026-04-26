import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateTenantConfigDto } from '@delivery/shared'

export const organizationService = {
  async create(dto: CreateOrganizationDto) {
    const existing = await prisma.organization.findUnique({ where: { slug: dto.slug } })
    if (existing) throw new AppError(409, `Slug "${dto.slug}" уже занят`)

    return prisma.organization.create({
      data: {
        name:    dto.name,
        slug:    dto.slug,
        inn:     dto.inn,
        logoUrl: dto.logoUrl,
        config:  { create: {} }, // дефолтный TenantConfig
      },
      include: { config: true },
    })
  },

  async getById(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { config: true },
    })
    if (!org) throw new AppError(404, 'Организация не найдена')
    return org
  },

  async list(page: number, limit: number) {
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { config: true },
      }),
      prisma.organization.count(),
    ])
    return { items, total, page, limit }
  },

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.getById(id)
    if (dto.slug) {
      const conflict = await prisma.organization.findFirst({ where: { slug: dto.slug, NOT: { id } } })
      if (conflict) throw new AppError(409, `Slug "${dto.slug}" уже занят`)
    }
    return prisma.organization.update({
      where: { id },
      data: dto,
      include: { config: true },
    })
  },

  async updateConfig(orgId: string, dto: UpdateTenantConfigDto) {
    await this.getById(orgId)
    return prisma.tenantConfig.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, ...dto },
      update: dto,
    })
  },

  async deactivate(id: string) {
    await this.getById(id)
    return prisma.$transaction([
      prisma.user.updateMany({ where: { organizationId: id }, data: { isActive: false } }),
      prisma.organization.update({ where: { id }, data: { isActive: false } }),
    ])
  },
}
