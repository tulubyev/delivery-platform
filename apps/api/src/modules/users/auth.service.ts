import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import { LoginDto, RegisterDto } from '@delivery/shared'
import { UserRole } from '@prisma/client'
import { smsruClient } from '../../infrastructure/notifications/smsru.client'

const JWT_SECRET     = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!
const OTP_TTL_MS     = 10 * 60 * 1000 // 10 минут

const signAccess = (sub: string, role: string, email: string, organizationId?: string | null) =>
  jwt.sign(
    { sub, role, email, ...(organizationId ? { organizationId } : {}) },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' } as jwt.SignOptions,
  )

const signRefresh = (sub: string) =>
  jwt.sign({ sub }, REFRESH_SECRET, { expiresIn: '30d' } as jwt.SignOptions)

const refreshExpiry = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function buildTokens(user: { id: string; role: string; email: string; organizationId?: string | null }) {
  return {
    accessToken:  signAccess(user.id, user.role, user.email, user.organizationId),
    refreshToken: signRefresh(user.id),
  }
}

export const authService = {
  // ── Регистрация ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    })
    if (existing) throw new AppError(409, 'Email или телефон уже зарегистрированы')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const otp          = generateOtp()
    const otpExpires   = new Date(Date.now() + OTP_TTL_MS)

    const user = await prisma.user.create({
      data: {
        email:              dto.email,
        passwordHash,
        name:               dto.name,
        phone:              dto.phone,
        role:               (dto.role as UserRole) ?? UserRole.COURIER,
        phoneOtp:           otp,
        phoneOtpExpiresAt:  otpExpires,
        phoneVerified:      false,
      },
    })

    if (user.role === UserRole.COURIER) {
      await prisma.courier.create({
        data: { userId: user.id, organizationId: user.organizationId ?? '' },
      })
    }

    // Отправляем OTP по SMS
    const smsText = `Ваш код подтверждения LastMiles: ${otp}. Действителен 10 минут.`
    await smsruClient.send(dto.phone, smsText).catch(() => {
      // Не блокируем регистрацию при ошибке SMS (логируем только)
      console.error('[auth] SMS send failed for', dto.phone)
    })

    return {
      message:   'Регистрация успешна. Введите код из SMS для подтверждения телефона.',
      userId:    user.id,
      phone:     user.phone,
      // В dev-режиме возвращаем OTP чтобы можно было тестировать без реального SMS
      ...(process.env.NODE_ENV !== 'production' ? { _devOtp: otp } : {}),
    }
  },

  // ── Подтверждение телефона по OTP ───────────────────────────────────────────
  async verifyPhone(userId: string, otp: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError(404, 'Пользователь не найден')
    if (user.phoneVerified) throw new AppError(400, 'Телефон уже подтверждён')

    if (
      !user.phoneOtp ||
      user.phoneOtp !== otp ||
      !user.phoneOtpExpiresAt ||
      user.phoneOtpExpiresAt < new Date()
    ) {
      throw new AppError(400, 'Неверный или истёкший код')
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { phoneVerified: true, phoneOtp: null, phoneOtpExpiresAt: null },
    })

    // Выдаём токены — пользователь теперь авторизован
    const { accessToken, refreshToken } = buildTokens(user)
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
    })

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId },
    }
  },

  // ── Повторная отправка OTP ───────────────────────────────────────────────────
  async resendOtp(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError(404, 'Пользователь не найден')
    if (user.phoneVerified) throw new AppError(400, 'Телефон уже подтверждён')

    // Rate-limit: не чаще раза в минуту
    if (user.phoneOtpExpiresAt && user.phoneOtpExpiresAt.getTime() - Date.now() > OTP_TTL_MS - 60_000) {
      throw new AppError(429, 'Повторная отправка возможна через 1 минуту')
    }

    const otp        = generateOtp()
    const otpExpires = new Date(Date.now() + OTP_TTL_MS)

    await prisma.user.update({
      where: { id: userId },
      data:  { phoneOtp: otp, phoneOtpExpiresAt: otpExpires },
    })

    await smsruClient.send(user.phone, `Ваш код LastMiles: ${otp}. Действителен 10 минут.`)

    return { message: 'Код отправлен повторно' }
  },

  // ── Вход ────────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } })
    if (!user || !user.isActive) throw new AppError(401, 'Неверный email или пароль')
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) throw new AppError(401, 'Неверный email или пароль')

    if (!user.phoneVerified) {
      throw new AppError(403, 'Телефон не подтверждён. Введите код из SMS.', { userId: user.id })
    }

    const { accessToken, refreshToken } = buildTokens(user)
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
    })

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId },
    }
  },

  // ── Обновление токена ────────────────────────────────────────────────────────
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

    return {
      accessToken:  signAccess(user.id, user.role, user.email, user.organizationId),
      refreshToken: newRefresh,
    }
  },

  // ── Выход ────────────────────────────────────────────────────────────────────
  async logout(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } })
  },
}
