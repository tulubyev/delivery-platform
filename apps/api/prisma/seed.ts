import { PrismaClient, UserRole, CourierType, CourierStatus, VerificationStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Организация ──────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where:  { slug: 'lastmiles-demo' },
    update: {},
    create: {
      name:        'LastMiles Demo',
      slug:        'lastmiles-demo',
      timezone:    'Europe/Moscow',
      smsApiKey:   process.env.SMSRU_API_ID ?? '',
      smsProvider: 'smsru',
      config: {
        slaMinutes:   60,
        dispatchMode: 'AUTO',
      },
    },
  })
  console.log('✅ Organization:', org.name, org.id)

  // ── Пользователи ─────────────────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 10)

  const users: Array<{
    email: string; phone: string; name: string
    role: UserRole; orgId: string | null; pw: string
  }> = [
    { email: 'admin@lastmiles.ru',      phone: '+70000000001', name: 'Платформенный Администратор', role: UserRole.ADMIN,      orgId: null,   pw: 'Admin1234!' },
    { email: 'orgadmin@lastmiles.ru',   phone: '+70000000002', name: 'Администратор Организации',   role: UserRole.ORG_ADMIN,  orgId: org.id, pw: 'OrgAdmin1234!' },
    { email: 'supervisor@lastmiles.ru', phone: '+70000000003', name: 'Диспетчер Иванов',            role: UserRole.SUPERVISOR, orgId: org.id, pw: 'Super1234!' },
    { email: 'courier1@lastmiles.ru',   phone: '+70000000004', name: 'Курьер Петров',               role: UserRole.COURIER,    orgId: org.id, pw: 'Courier1234!' },
    { email: 'courier2@lastmiles.ru',   phone: '+70000000005', name: 'Курьер Сидоров',              role: UserRole.COURIER,    orgId: org.id, pw: 'Courier1234!' },
    { email: 'client@lastmiles.ru',     phone: '+70000000006', name: 'B2B Клиент ООО Ромашка',      role: UserRole.CLIENT,     orgId: org.id, pw: 'Client1234!' },
  ]

  for (const u of users) {
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: {
        email:          u.email,
        phone:          u.phone,
        name:           u.name,
        role:           u.role,
        passwordHash:   await hash(u.pw),
        organizationId: u.orgId,
        phoneVerified:  true, // seed-пользователи уже верифицированы
        isActive:       true,
      },
    })
    console.log(`✅ User [${u.role}]:`, user.email, '/ password:', u.pw)

    // Courier профиль
    if (u.role === UserRole.COURIER && u.orgId) {
      await prisma.courier.upsert({
        where:  { userId: user.id },
        update: {},
        create: {
          userId:             user.id,
          organizationId:     u.orgId,
          type:               CourierType.STAFF,
          status:             CourierStatus.OFFLINE,
          verificationStatus: VerificationStatus.APPROVED,
          vehicle:            'bicycle',
          rating:             4.8,
        },
      })
    }

    // Client профиль
    if (u.role === UserRole.CLIENT && u.orgId) {
      await prisma.client.upsert({
        where:  { userId: user.id },
        update: {},
        create: {
          userId:         user.id,
          organizationId: u.orgId,
          companyName:    'ООО Ромашка',
          contractNumber: 'CTR-2026-001',
        },
      })
    }
  }

  // ── Зона доставки ────────────────────────────────────────────────────────────
  const zone = await prisma.zone.upsert({
    where:  { id: 'seed-zone-central' },
    update: {},
    create: {
      id:             'seed-zone-central',
      organizationId: org.id,
      name:           'Центр города',
      basePrice:      150,
      pricePerKm:     25,
      maxDeliveryMin: 45,
      isActive:       true,
      polygon: {
        type: 'Polygon',
        coordinates: [[
          [37.60, 55.75], [37.65, 55.75], [37.65, 55.78],
          [37.60, 55.78], [37.60, 55.75],
        ]],
      },
    },
  })
  console.log('✅ Zone:', zone.name)

  // ── Склад ────────────────────────────────────────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where:  { id: 'seed-warehouse-main' },
    update: {},
    create: {
      id:             'seed-warehouse-main',
      organizationId: org.id,
      name:           'Главный склад',
      address:        'Москва, ул. Тверская, 1',
      lat:            55.7558,
      lon:            37.6176,
      isActive:       true,
    },
  })
  console.log('✅ Warehouse:', warehouse.name)

  console.log('\n🎉 Seed completed!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Тестовые учётные данные:')
  console.log('  ADMIN:      admin@lastmiles.ru       / Admin1234!')
  console.log('  ORG_ADMIN:  orgadmin@lastmiles.ru    / OrgAdmin1234!')
  console.log('  SUPERVISOR: supervisor@lastmiles.ru  / Super1234!')
  console.log('  COURIER:    courier1@lastmiles.ru    / Courier1234!')
  console.log('  CLIENT:     client@lastmiles.ru      / Client1234!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
