import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.')
}
const JWT_SECRET_KEY = new TextEncoder().encode(jwtSecret || 'dev-secret-change-me')
const SALT_ROUNDS = 10

export async function hashPin(pin) {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

export async function verifyPin(pin, hash) {
  return bcrypt.compare(pin, hash)
}

export async function createToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(JWT_SECRET_KEY)
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY)
    return payload
  } catch {
    return null
  }
}
