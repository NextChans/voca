/**
 * 초대코드 (src/lib/domain/invite.ts) 단위 테스트
 */
import { describe, expect, it } from 'vitest';
import {
  INVITE_TTL_MS,
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  normalizeInviteCode,
} from '@/lib/domain/invite';

describe('generateInviteCode', () => {
  const codes = Array.from({ length: 500 }, () => generateInviteCode());

  it('is 8 characters long', () => {
    for (const c of codes) expect(c).toHaveLength(8);
  });
  it('uses only the unambiguous alphabet (no 0 O 1 I L)', () => {
    for (const c of codes) {
      expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
      expect(c).not.toMatch(/[0O1IL]/);
    }
  });
  it('is stable under normalization', () => {
    for (const c of codes) expect(normalizeInviteCode(c)).toBe(c);
  });
  it('is random (no collisions in a small sample, many distinct chars)', () => {
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(codes.join('')).size).toBeGreaterThan(25);
  });
});

describe('INVITE_TTL_MS', () => {
  it('is 72 hours', () => {
    expect(INVITE_TTL_MS).toBe(72 * 3600 * 1000);
  });
});

describe('normalizeInviteCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeInviteCode('abcd2345')).toBe('ABCD2345');
  });
  it('removes dashes, spaces and other separators', () => {
    expect(normalizeInviteCode('ABCD-2345')).toBe('ABCD2345');
    expect(normalizeInviteCode(' abcd 2345 ')).toBe('ABCD2345');
    expect(normalizeInviteCode('ab-cd 23\t45\n')).toBe('ABCD2345');
    expect(normalizeInviteCode('abcd_2345.')).toBe('ABCD2345');
  });
  it('returns empty for empty / separator-only input', () => {
    expect(normalizeInviteCode('')).toBe('');
    expect(normalizeInviteCode(' - ')).toBe('');
  });
});

describe('hashInviteCode', () => {
  const h = hashInviteCode('ABCD2345');

  it('is a sha256 hex digest', () => {
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('is deterministic', () => {
    expect(hashInviteCode('ABCD2345')).toBe(h);
  });
  it('is stable across formatting (case, dashes, spaces)', () => {
    for (const v of ['abcd2345', 'ABCD-2345', 'abcd-2345', ' abcd 2345 ', 'Ab Cd-23 45'])
      expect(hashInviteCode(v)).toBe(h);
  });
  it('matches the hash of the formatted code', () => {
    expect(hashInviteCode(formatInviteCode('ABCD2345'))).toBe(h);
  });
  it('differs for different codes', () => {
    expect(hashInviteCode('ABCD2346')).not.toBe(h);
  });
  it('is domain-separated (not a plain sha256 of the code)', async () => {
    const { createHash } = await import('node:crypto');
    expect(h).not.toBe(createHash('sha256').update('ABCD2345').digest('hex'));
  });
});

describe('formatInviteCode', () => {
  it('splits into 4-4 with a dash', () => {
    expect(formatInviteCode('ABCD2345')).toBe('ABCD-2345');
  });
  it('roundtrips through normalize', () => {
    const c = generateInviteCode();
    expect(normalizeInviteCode(formatInviteCode(c))).toBe(c);
  });
});
