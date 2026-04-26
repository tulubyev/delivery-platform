import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import { LoginDto, RegisterDto } from '@delivery/shared'
import { UserRole } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!

const signAccess = (sub: string, role: string, email: string, organizationId?: string | null) =>
  jwt.sign({ sub, role, email, ...(organizationId ? { organizationId } : {}) }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' } as jwt.SignOptions)
const signRefresh = (sub: string) =>
  jwt.sign({ sub }, REFRESH_SECRET, { expiresIn: '30d' } as jwt.SignOptions)
const refreshExpiry = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

export const authService = {
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ email: dto.email }, { phone: dto.phone }] } })
    if (existing) throw new AppError(409, 'Email или телефон уже зарегистрированы')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = await prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name, phone: dto.phone, role: (dto.role as UserRole) ?? UserRole.COURIER },
    })
    if (user.role === UserRole.COURIER) {
      await prisma.courier.create({ data: { userId: user.id, organizationId: user.organizationId ?? '' } })
    }

    const refreshToken = signRefresh(user.id)
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() } })

    return { accessToken: signAccess(user.id, user.role, user.email, user.organizationId), refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId } }
  },

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } })
    if (!user || !user.isActive) throw new AppError(401, 'Неверный email или пароль')
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) throw new AppError(401, 'Неверный email или пароль')

    const refreshToken = signRefresh(user.id)
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() } })

    return { accessToken: signAccess(user.id, user.role, user.email, user.organizationId), refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId } }
  },

  async refresh(token: string) {
    let payload: jwt.JwtPayload
    try { payload = jwt.verify(token, REFRESH_SECRET) as jwt.JwtPayload }
    catch { throw new AppError(401, 'Refresh token недействителен') }

    const stored = await prisma.refreshToken.findUnique({ where: { token } })
    if (!stored || stored.expiresAt < new Date()) throw new AppError(401, 'Refresh token истёк')

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new AppError(401, 'Пользователь не найден')

    await prisma.refreshToken.delete({ where: { token } })
    const newRefresh = signRefresh(user.id)
    await prisma.refreshToken.create({ data: { token: newRefresh, userId: user.id, expiresAt: refreshExpiry() } })

    return { accessToken: signAccess(user.id, user.role, user.email, user.organizationId), refreshToken: newRefresh }
  },

  async logout(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } })
  },
}
