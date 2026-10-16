/**
 * KST 주간 규칙 (src/lib/domain/week.ts) 단위 테스트 — 월요일 00:00 KST 시작, UTC+9 고정
 */
import { describe, expect, it } from 'vitest';
import { formatKst, isTestableWord, kstDate, kstWeekStart, weekRangeLabel } from '@/lib/domain/week';

describe('kstWeekStart', () => {
  it('Sunday 23:59 KST still belongs to the week that started the previous Monday', () => {
    // 2026-10-18(일) 23:59 KST = 2026-10-18 14:59 UTC
    expect(kstWeekStart(new Date('2026-10-18T14:59:00Z'))).toBe('2026-10-12');
    expect(kstWeekStart(new Date('2026-10-18T14:59:59.999Z'))).toBe('2026-10-12');
  });
  it('Monday 00:00 KST (= Sunday 15:00 UTC) starts a new week', () => {
    expect(kstWeekStart(new Date('2026-10-18T15:00:00Z'))).toBe('2026-10-19');
  });
  it('Monday morning UTC is still the same KST week', () => {
    expect(kstWeekStart(new Date('2026-10-12T00:00:00Z'))).toBe('2026-10-12'); // 월 09:00 KST
  });
  it('Sunday 23:00 UTC is already Monday in KST', () => {
    expect(kstWeekStart(new Date('2026-10-11T23:00:00Z'))).toBe('2026-10-12'); // 월 08:00 KST
  });
  it('mid-week dates map to that Monday', () => {
    expect(kstWeekStart(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-12'); // 수
    expect(kstWeekStart(new Date('2026-10-16T12:00:00Z'))).toBe('2026-10-12'); // 금 21:00 KST
  });
  it('handles the year boundary (week of 2026-01-01 starts 2025-12-29)', () => {
    expect(kstWeekStart(new Date('2025-12-31T15:00:00Z'))).toBe('2025-12-29'); // 2026-01-01 00:00 KST
    expect(kstWeekStart(new Date('2026-01-04T14:59:00Z'))).toBe('2025-12-29'); // 2026-01-04(일) 23:59 KST
    expect(kstWeekStart(new Date('2026-01-04T15:00:00Z'))).toBe('2026-01-05'); // 2026-01-05(월) 00:00 KST
  });
  it('handles a leap day', () => {
    expect(kstWeekStart(new Date('2024-02-29T05:00:00Z'))).toBe('2024-02-26');
  });
  it('defaults to now and returns a Monday in YYYY-MM-DD form', () => {
    const ws = kstWeekStart();
    expect(ws).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${ws}T00:00:00Z`).getUTCDay()).toBe(1);
  });
});

describe('weekRangeLabel', () => {
  it('formats Monday to Sunday', () => {
    expect(weekRangeLabel('2026-10-12')).toBe('10/12(월) ~ 10/18(일)');
  });
  it('crosses month and year boundaries', () => {
    expect(weekRangeLabel('2026-09-28')).toBe('9/28(월) ~ 10/4(일)');
    expect(weekRangeLabel('2025-12-29')).toBe('12/29(월) ~ 1/4(일)');
  });
  it('handles February in a leap year', () => {
    expect(weekRangeLabel('2024-02-26')).toBe('2/26(월) ~ 3/3(일)');
  });
});

describe('kstDate', () => {
  it('converts a UTC instant to the KST calendar date', () => {
    expect(kstDate(new Date('2026-10-18T14:59:00Z'))).toBe('2026-10-18');
    expect(kstDate(new Date('2026-10-18T15:00:00Z'))).toBe('2026-10-19');
  });
  it('accepts ISO strings (with Z or offset)', () => {
    expect(kstDate('2026-10-18T15:00:00Z')).toBe('2026-10-19');
    expect(kstDate('2026-10-19T00:00:00+09:00')).toBe('2026-10-19');
    expect(kstDate('2026-10-18T23:59:59+09:00')).toBe('2026-10-18');
  });
  it('crosses the year boundary', () => {
    expect(kstDate('2025-12-31T15:00:00Z')).toBe('2026-01-01');
  });
});

describe('formatKst', () => {
  it('formats in Asia/Seoul time with weekday', () => {
    const s = formatKst('2026-10-18T15:00:00Z');
    expect(s).toContain('10');
    expect(s).toContain('19');
    expect(s).toContain('월');
    expect(s).toContain('00:00');
  });
  it('omits time when withTime=false', () => {
    const s = formatKst('2026-10-18T15:00:00Z', false);
    expect(s).toContain('월');
    expect(s).not.toContain(':');
  });
});

describe('isTestableWord', () => {
  const todayMidnightKst = new Date('2026-10-15T15:00:00Z'); // 2026-10-16 00:00 KST

  it('word registered yesterday 23:59 KST is testable at 00:00 KST today', () => {
    expect(isTestableWord('2026-10-15T14:59:00Z', todayMidnightKst)).toBe(true);
    expect(isTestableWord('2026-10-15T23:59:00+09:00', todayMidnightKst)).toBe(true);
  });
  it('word registered at 00:00 KST today is not testable today', () => {
    expect(isTestableWord('2026-10-15T15:00:00Z', todayMidnightKst)).toBe(false);
  });
  it('word registered later today is not testable today', () => {
    const now = new Date('2026-10-16T14:59:00Z'); // 2026-10-16 23:59 KST
    expect(isTestableWord('2026-10-16T01:00:00Z', now)).toBe(false);
  });
  it('word registered today becomes testable at next KST midnight', () => {
    expect(isTestableWord('2026-10-16T01:00:00Z', new Date('2026-10-16T15:00:00Z'))).toBe(true);
  });
  it('same UTC date but different KST date counts by KST', () => {
    // 등록: 10/15 14:00 UTC (= 10/15 23:00 KST), now: 10/15 16:00 UTC (= 10/16 01:00 KST)
    expect(isTestableWord('2026-10-15T14:00:00Z', new Date('2026-10-15T16:00:00Z'))).toBe(true);
  });
  it('older words are testable', () => {
    expect(isTestableWord('2025-01-01T00:00:00Z', todayMidnightKst)).toBe(true);
  });
  it('a future creation time is not testable', () => {
    expect(isTestableWord('2026-10-20T00:00:00Z', todayMidnightKst)).toBe(false);
  });
});
