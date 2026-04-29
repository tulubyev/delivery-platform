import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY не задан')
  // Accept both hex (64 chars) and base64-encoded 32-byte keys
  const key = raw.length === 64 ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY должен быть 32 байта')
  return key
}

export const encryptionService = {
  encrypt(plaintext: string): string {
    const key = getKey()
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv(ALGO, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    // формат: base64(iv[12] + tag[16] + ciphertext)
    return Buffer.concat([iv, tag, encrypted]).toString('base64')
  },

  decrypt(stored: string): string {
    const key = getKey()
    const buf = Buffer.from(stored, 'base64')
    const iv = buf.subarray(0, IV_LEN)
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const data = buf.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  },

  // Шифрует значения объекта по списку ключей
  encryptFields<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
    const result = { ...obj }
    for (const field of fields) {
      if (result[field] != null) {
        result[field] = this.encrypt(
          typeof result[field] === 'string' ? (result[field] as string) : JSON.stringify(result[field])
        ) as T[keyof T]
      }
    }
    return result
  },

  decryptFields<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
    const result = { ...obj }
    for (const field of fields) {
      if (result[field] != null) {
        result[field] = this.decrypt(result[field] as string) as T[keyof T]
      }
    }
    return result
  },
}
