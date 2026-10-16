import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * 부모 모드 보안 프리미티브 (node:crypto, 순수 함수)
 *  - PIN 해시: scrypt(N=16384) + 16바이트 salt → "scrypt$<salt>$<hash>"
 *  - 잠금해제 토큰: "<userId>.<expMs>.<hmac>" (HMAC-SHA256, httpOnly 쿠키로만 전달)
 */
const KEYLEN = 32;

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(pin, Buffer.from(saltB64, 'base64'), expected.length);
  return expected.length === KEYLEN && timingSafeEqual(actual, expected);
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueUnlockToken(userId: string, ttlMs: number, secret: string, now = Date.now()): string {
  const payload = `${userId}.${now + ttlMs}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyUnlockToken(
  token: string | undefined,
  userId: string,
  secret: string,
  now = Date.now()
): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const mac = Buffer.from(token.slice(lastDot + 1));
  const expectedMac = Buffer.from(sign(payload, secret));
  if (mac.length !== expectedMac.length || !timingSafeEqual(mac, expectedMac)) return false;
  const [uid, exp] = payload.split('.');
  return uid === userId && Number(exp) > now;
}
