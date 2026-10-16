import { createHash, randomInt } from 'node:crypto';

// 헷갈리는 문자(0/O, 1/I/L) 제외
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

/** 8자리 초대코드 (31^8 ≈ 8.5e11, 1회용·72시간 만료) */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** DB 에는 원문 대신 해시만 저장 */
export function hashInviteCode(code: string): string {
  return createHash('sha256').update(`voca-invite:${normalizeInviteCode(code)}`).digest('hex');
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
