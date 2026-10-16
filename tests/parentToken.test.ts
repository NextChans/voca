/**
 * 부모 모드 보안 프리미티브 (src/lib/domain/parentToken.ts) 단위 테스트
 */
import { describe, expect, it } from 'vitest';
import { hashPin, isValidPin, issueUnlockToken, verifyPin, verifyUnlockToken } from '@/lib/domain/parentToken';

describe('isValidPin', () => {
  it('accepts 4–8 digits', () => {
    for (const p of ['1234', '0000', '12345', '123456', '1234567', '12345678']) expect(isValidPin(p)).toBe(true);
  });
  it('rejects too short / too long', () => {
    expect(isValidPin('')).toBe(false);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('123456789')).toBe(false);
  });
  it('rejects non-digits, whitespace and unicode digits', () => {
    for (const p of ['12a4', 'abcd', ' 1234', '1234 ', '12 34', '12.34', '-1234', '１２３４', '١٢٣٤', '1234\n'])
      expect(isValidPin(p)).toBe(false);
  });
});

describe('hashPin / verifyPin', () => {
  const stored = hashPin('1234');

  it('produces "scrypt$<salt>$<hash>" with 16-byte salt and 32-byte hash', () => {
    const [scheme, salt, hash] = stored.split('$');
    expect(scheme).toBe('scrypt');
    expect(Buffer.from(salt!, 'base64')).toHaveLength(16);
    expect(Buffer.from(hash!, 'base64')).toHaveLength(32);
  });
  it('salts: the same pin hashes differently each time', () => {
    expect(hashPin('1234')).not.toBe(stored);
  });
  it('roundtrips the correct pin', () => {
    expect(verifyPin('1234', stored)).toBe(true);
  });
  it('rejects a wrong pin', () => {
    expect(verifyPin('1235', stored)).toBe(false);
    expect(verifyPin('12345', stored)).toBe(false);
    expect(verifyPin('', stored)).toBe(false);
  });
  it('rejects (without throwing) malformed stored hashes', () => {
    const [, salt, hash] = stored.split('$');
    const bad = [
      '',
      'garbage',
      'scrypt',
      'scrypt$',
      'scrypt$$',
      `scrypt$${salt}`,
      `scrypt$${salt}$`,
      `scrypt$$${hash}`,
      `bcrypt$${salt}$${hash}`,
      'scrypt$!!!$!!!',
      'scrypt$AAAA$AAAA', // 짧은 해시 (3바이트)
      `scrypt$${salt}$${Buffer.alloc(64).toString('base64')}`, // 긴 해시
    ];
    for (const s of bad) {
      expect(() => verifyPin('1234', s)).not.toThrow();
      expect(verifyPin('1234', s)).toBe(false);
    }
  });
  it('rejects when the stored hash is tampered', () => {
    const [scheme, salt, hash] = stored.split('$');
    const buf = Buffer.from(hash!, 'base64');
    buf[0] = buf[0]! ^ 0xff;
    expect(verifyPin('1234', `${scheme}$${salt}$${buf.toString('base64')}`)).toBe(false);
  });
});

describe('issueUnlockToken / verifyUnlockToken', () => {
  const SECRET = 'test-secret-1';
  const USER = '00000000-0000-0000-0000-00000000000a';
  const OTHER = '00000000-0000-0000-0000-00000000000b';
  const NOW = 1_760_000_000_000;
  const TTL = 15 * 60 * 1000;
  const token = issueUnlockToken(USER, TTL, SECRET, NOW);

  it('has the form <userId>.<expMs>.<mac>', () => {
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(USER);
    expect(parts[1]).toBe(String(NOW + TTL));
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is deterministic for the same inputs', () => {
    expect(issueUnlockToken(USER, TTL, SECRET, NOW)).toBe(token);
  });
  it('verifies a valid token before expiry', () => {
    expect(verifyUnlockToken(token, USER, SECRET, NOW)).toBe(true);
    expect(verifyUnlockToken(token, USER, SECRET, NOW + TTL - 1)).toBe(true);
  });
  it('rejects at and after expiry', () => {
    expect(verifyUnlockToken(token, USER, SECRET, NOW + TTL)).toBe(false);
    expect(verifyUnlockToken(token, USER, SECRET, NOW + TTL + 1)).toBe(false);
  });
  it('rejects a token for another user', () => {
    expect(verifyUnlockToken(token, OTHER, SECRET, NOW)).toBe(false);
  });
  it('rejects a tampered mac', () => {
    const mac = token.slice(token.lastIndexOf('.') + 1);
    const flipped = (mac[0] === 'A' ? 'B' : 'A') + mac.slice(1);
    expect(verifyUnlockToken(token.slice(0, token.lastIndexOf('.') + 1) + flipped, USER, SECRET, NOW)).toBe(false);
    expect(verifyUnlockToken(token + 'x', USER, SECRET, NOW)).toBe(false);
    expect(verifyUnlockToken(token.slice(0, -1), USER, SECRET, NOW)).toBe(false);
  });
  it('rejects a tampered payload (extended expiry / swapped user)', () => {
    const mac = token.slice(token.lastIndexOf('.') + 1);
    expect(verifyUnlockToken(`${USER}.${NOW + TTL * 100}.${mac}`, USER, SECRET, NOW + TTL)).toBe(false);
    expect(verifyUnlockToken(`${OTHER}.${NOW + TTL}.${mac}`, OTHER, SECRET, NOW)).toBe(false);
  });
  it('rejects a token signed with a different secret', () => {
    expect(verifyUnlockToken(token, USER, 'other-secret', NOW)).toBe(false);
    expect(verifyUnlockToken(issueUnlockToken(USER, TTL, 'other-secret', NOW), USER, SECRET, NOW)).toBe(false);
  });
  it('rejects undefined / empty / malformed tokens', () => {
    expect(verifyUnlockToken(undefined, USER, SECRET, NOW)).toBe(false);
    expect(verifyUnlockToken('', USER, SECRET, NOW)).toBe(false);
    expect(verifyUnlockToken('nodots', USER, SECRET, NOW)).toBe(false);
    expect(verifyUnlockToken('...', USER, SECRET, NOW)).toBe(false);
    expect(verifyUnlockToken(`${USER}.${NOW + TTL}`, USER, SECRET, NOW)).toBe(false);
  });
  it('a negative ttl yields an already-expired token', () => {
    expect(verifyUnlockToken(issueUnlockToken(USER, -1, SECRET, NOW), USER, SECRET, NOW)).toBe(false);
  });
  it('uses Date.now() by default', () => {
    const t = issueUnlockToken(USER, 60_000, SECRET);
    expect(verifyUnlockToken(t, USER, SECRET)).toBe(true);
  });
});
