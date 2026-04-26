import Redis from 'ioredis'
const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
export const redis = new Redis(url, { maxRetriesPerRequest: 3 })
redis.on('connect', () => console.log('✅ Redis connected'))
redis.on('error', (e) => console.error('❌ Redis:', e))
export const createRedisConnection = () => new Redis(url, { maxRetriesPerRequest: null })
