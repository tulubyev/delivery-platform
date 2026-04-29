import { z } from 'zod'

export const UserRole = z.enum(['ADMIN', 'DISPATCHER', 'COURIER', 'CLIENT'])
export type UserRole = z.infer<typeof UserRole>
export const CourierType = z.enum(['STAFF', 'CONTRACTOR', 'FREELANCER'])
export type CourierType = z.infer<typeof CourierType>
export const OrderStatus = z.enum(['CREATED','ASSIGNED','PICKED_UP','IN_TRANSIT','DELIVERED','FAILED','CANCELLED','RETURNING'])
export type OrderStatus = z.infer<typeof OrderStatus>
export const VehicleType = z.enum(['FOOT', 'BIKE', 'MOTO', 'CAR'])
export type VehicleType = z.infer<typeof VehicleType>
export const VerificationStatus = z.enum(['UNSUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'])
export type VerificationStatus = z.infer<typeof VerificationStatus>

export const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })
export type LoginDto = z.infer<typeof LoginSchema>

export const RegisterSchema = z.object({
  email: z.string().email(), password: z.string().min(8), name: z.string().min(2),
  phone: z.string().regex(/^\+7\d{10}$/), role: UserRole.optional().default('COURIER'),
})
export type RegisterDto = z.infer<typeof RegisterSchema>

export const AddressSchema = z.object({
  city: z.string(), street: z.string(), building: z.string(),
  apartment: z.string().optional(), lat: z.number().optional(), lon: z.number().optional(), comment: z.string().optional(),
})
export type Address = z.infer<typeof AddressSchema>

// ── Organization ──────────────────────────────────────────────────────────────

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Только строчные буквы, цифры и дефис'),
  inn:  z.string().regex(/^\d{10}(\d{2})?$/).optional(),
  logoUrl: z.string().url().optional(),
})
export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>

export const UpdateOrganizationSchema = z.object({
  name:         z.string().min(2).max(100).optional(),
  slug:         z.string().regex(/^[a-z0-9-]+$/).optional(),
  inn:          z.string().regex(/^\d{10}(\d{2})?$/).optional(),
  kpp:          z.string().optional(),
  ogrn:         z.string().optional(),
  legalAddress: z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().email().optional(),
  website:      z.string().optional(),
  contractNo:   z.string().optional(),
  contractDate: z.string().optional(),
  logoUrl:      z.string().url().optional(),
})
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>

export const UpdateTenantConfigSchema = z.object({
  dispatchMode:               z.enum(['AUTO', 'COMPETITIVE', 'MANUAL']).optional(),
  competitiveOfferTimeoutSec: z.number().int().min(30).max(600).optional(),
  autoDispatchRadiusKm:       z.number().min(0.5).max(50).optional(),
  shiftsEnabled:              z.boolean().optional(),
  warehousesEnabled:          z.boolean().optional(),
  routeOptimizationEnabled:   z.boolean().optional(),
  encryptionEnabled:          z.boolean().optional(),
  slaMinutes:                 z.number().int().min(10).max(1440).optional(),
  stuckThresholdMin:          z.number().int().min(5).max(60).optional(),
  offlineThresholdMin:        z.number().int().min(5).max(60).optional(),
  gpsIntervalSec:             z.number().int().min(10).max(120).optional(),
  twoGisApiKey:               z.string().optional(),
  smsProvider:                z.string().optional(),
  smsApiKey:                  z.string().optional(),
  waApiKey:                   z.string().optional(),
  callProvider:               z.string().optional(),
  callApiKey:                 z.string().optional(),
})
export type UpdateTenantConfigDto = z.infer<typeof UpdateTenantConfigSchema>

// ── Zones ─────────────────────────────────────────────────────────────────────

const GeoJsonPolygonSchema = z.object({
  type:        z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
})

export const CreateZoneSchema = z.object({
  name:           z.string().min(1).max(100),
  polygon:        GeoJsonPolygonSchema,
  basePrice:      z.number().nonnegative().optional(),
  pricePerKm:     z.number().nonnegative().optional(),
  maxDeliveryMin: z.number().int().min(1).max(1440).optional(),
})
export type CreateZoneDto = z.infer<typeof CreateZoneSchema>

export const UpdateZoneSchema = CreateZoneSchema.partial()
export type UpdateZoneDto = z.infer<typeof UpdateZoneSchema>

// ── Courier onboarding ────────────────────────────────────────────────────────

export const SubmitDocumentsSchema = z.object({
  passportSeries:   z.string().regex(/^\d{4}$/, 'Серия — 4 цифры'),
  passportNumber:   z.string().regex(/^\d{6}$/, 'Номер — 6 цифр'),
  passportPhotoUrl: z.string().url().optional(),
  innNumber:        z.string().regex(/^\d{12}$/, 'ИНН — 12 цифр'),
  innPhotoUrl:      z.string().url().optional(),
  selfEmployed:     z.boolean().optional(),
})
export type SubmitDocumentsDto = z.infer<typeof SubmitDocumentsSchema>

export const ReviewDocumentsSchema = z.object({
  approve:  z.boolean(),
  comment:  z.string().max(500).optional(),
})
export type ReviewDocumentsDto = z.infer<typeof ReviewDocumentsSchema>

// ── Orders ────────────────────────────────────────────────────────────────────

export const CreateOrderSchema = z.object({
  externalId:        z.string().optional(),
  clientId:          z.string().uuid(),
  warehouseId:       z.string().uuid().optional(),
  pickupPointId:     z.string().uuid().optional(),
  dispatchMode:      z.enum(['AUTO', 'COMPETITIVE', 'MANUAL']).optional(),
  pickupAddress:     AddressSchema,
  deliveryAddress:   AddressSchema,
  recipientName:     z.string().min(2).max(100),
  recipientPhone:    z.string().regex(/^\+7\d{10}$/),
  weight:            z.number().positive().optional(),
  dimensions:        z.object({ length: z.number(), width: z.number(), height: z.number() }).optional(),
  declaredValue:     z.number().nonnegative().optional(),
  paymentOnDelivery: z.number().nonnegative().optional(),
  scheduledAt:       z.coerce.date().optional(),
  notes:             z.string().max(500).optional(),
})
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>

export const UpdateOrderStatusSchema = z.object({
  status:       z.enum(['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURNING']),
  comment:      z.string().max(500).optional(),
  photoUrl:     z.string().url().optional(),
  signatureUrl: z.string().url().optional(),
  lat:          z.number().optional(),
  lon:          z.number().optional(),
})
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>

export const AssignOrderSchema = z.object({
  orderId:   z.string().uuid(),
  courierId: z.string().uuid(),
})
export type AssignOrderDto = z.infer<typeof AssignOrderSchema>

export const OrderFiltersSchema = z.object({
  status:    z.enum(['CREATED','ASSIGNED','PICKED_UP','IN_TRANSIT','DELIVERED','FAILED','CANCELLED','RETURNING']).optional(),
  courierId: z.string().uuid().optional(),
  clientId:  z.string().uuid().optional(),
  zoneId:    z.string().uuid().optional(),
  dateFrom:  z.coerce.date().optional(),
  dateTo:    z.coerce.date().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
})
export type OrderFiltersDto = z.infer<typeof OrderFiltersSchema>

// ── Geo ───────────────────────────────────────────────────────────────────────

export const GeoPointSchema = z.object({
  courierId: z.string().uuid(), lat: z.number(), lon: z.number(),
  speed: z.number().optional(), heading: z.number().optional(),
  accuracy: z.number().optional(), timestamp: z.coerce.date(),
})
export type GeoPoint = z.infer<typeof GeoPointSchema>

export type WsServerEvents =
  | { type: 'COURIER_LOCATION'; payload: GeoPoint }
  | { type: 'ORDER_STATUS'; payload: { orderId: string; status: OrderStatus } }
  | { type: 'ORDER_ASSIGNED'; payload: { orderId: string; courierId: string } }
  | { type: 'ETA_UPDATE'; payload: { orderId: string; etaMinutes: number } }

export type WsClientEvents =
  | { type: 'SUBSCRIBE_ORDER'; payload: { orderId: string } }
  | { type: 'SUBSCRIBE_COURIER'; payload: { courierId: string } }
  | { type: 'SUBSCRIBE_ORG'; payload: Record<string, never> }
  | { type: 'LOCATION_UPDATE'; payload: GeoPoint }

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiError { success: false; error: string; details?: unknown }
export type ApiResponse<T> = ApiSuccess<T> | ApiError
export const ok = <T>(data: T): ApiSuccess<T> => ({ success: true, data })
export const err = (e: string, d?: unknown): ApiError => ({ success: false, error: e, details: d })
