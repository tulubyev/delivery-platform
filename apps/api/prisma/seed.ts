import { PrismaClient, UserRole, CourierType, VehicleType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding...')

  const adminHash = await bcrypt.hash('Admin1234!', 10)
  await prisma.user.upsert({
    where: { email: 'admin@delivery.local' },
    update: {},
    create: { email: 'admin@delivery.local', passwordHash: adminHash, name: 'Администратор', phone: '+79000000001', role: UserRole.ADMIN },
  })

  const dispHash = await bcrypt.hash('Disp1234!', 10)
  await prisma.user.upsert({
    where: { email: 'dispatcher@delivery.local' },
    update: {},
    create: { email: 'dispatcher@delivery.local', passwordHash: dispHash, name: 'Иванов Сергей', phone: '+79000000002', role: UserRole.DISPATCHER },
  })

  const courierHash = await bcrypt.hash('Courier123!', 10)
  const courierUser = await prisma.user.upsert({
    where: { email: 'courier1@delivery.local' },
    update: {},
    create: { email: 'courier1@delivery.local', passwordHash: courierHash, name: 'Петров Алексей', phone: '+79000000003', role: UserRole.COURIER },
  })
  await prisma.courier.upsert({
    where: { userId: courierUser.id },
    update: {},
    create: { userId: courierUser.id, type: CourierType.FREELANCER, vehicleType: VehicleType.BIKE, selfEmployed: true },
  })

  const clientHash = await bcrypt.hash('Client123!', 10)
  const clientUser = await prisma.user.upsert({
    where: { email: 'client1@delivery.local' },
    update: {},
    create: { email: 'client1@delivery.local', passwordHash: clientHash, name: 'ООО Ромашка', phone: '+79000000004', role: UserRole.CLIENT },
  })
  await prisma.client.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id, companyName: 'ООО Ромашка', inn: '7700000001' },
  })

  await prisma.payoutRule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Базовый тариф', baseRate: 150, kmRate: 15, penaltyPerLate: 50, isDefault: true },
  })

  console.log('✅ Seed complete')
  console.log('   admin@delivery.local / Admin1234!')
  console.log('   dispatcher@delivery.local / Disp1234!')
  console.log('   courier1@delivery.local / Courier123!')
  console.log('   client1@delivery.local / Client123!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
