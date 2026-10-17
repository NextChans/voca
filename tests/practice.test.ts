import { describe, expect, it } from 'vitest';
import { buildNewWords, buildPracticeWords, type PracticeResultRow } from '@/lib/domain/practice';

const row = (term: string, ok: boolean | null, at: string, meaning = '뜻'): PracticeResultRow => ({
  word_id: null,
  term,
  meaning,
  is_correct: ok,
  submitted_at: at,
});

describe('buildPracticeWords', () => {
  it('한 번이라도 틀린 단어만, 마지막 결과·횟수를 집계한다', () => {
    const words = buildPracticeWords([
      row('apple', false, '2026-10-01'),
      row('apple', true, '2026-10-03'),
      row('banana', true, '2026-10-01'),
      row('cherry', false, '2026-10-02'),
      row('Cherry', false, '2026-10-04'),
      row('grape', null, '2026-10-04'),
    ]);
    expect(words.map((w) => w.key)).toEqual(['cherry', 'apple']); // 최근 오답 우선
    expect(words[0]).toMatchObject({ wrongCount: 2, attempts: 2, lastWrong: true, lastWrongAt: '2026-10-04' });
    expect(words[1]).toMatchObject({ wrongCount: 1, attempts: 2, lastWrong: false });
  });

  it('정렬: 최근 오답 → 틀린 횟수 많은 순 → 최근에 틀린 순', () => {
    const words = buildPracticeWords([
      row('a', false, '2026-10-01'),
      row('a', true, '2026-10-02'),
      row('b', false, '2026-10-01'),
      row('b', false, '2026-10-02'),
      row('b', true, '2026-10-03'),
      row('c', false, '2026-10-05'),
    ]);
    expect(words.map((w) => w.key)).toEqual(['c', 'b', 'a']);
  });

  it('입력 순서와 무관하게 가장 최근 뜻을 사용한다', () => {
    const words = buildPracticeWords([
      row('dog', false, '2026-10-05', '개, 강아지'),
      row('dog', false, '2026-10-01', '개'),
    ]);
    expect(words[0]?.meaning).toBe('개, 강아지');
  });
});

describe('buildNewWords', () => {
  const w = (id: string, created_at: string) => ({ id, term: `t-${id}`, meaning: `m-${id}`, created_at });
  // 2026-10-17 00:30 KST
  const now = new Date('2026-10-16T15:30:00Z');

  it('이미 정기 시험에 나온 단어는 빼고 등록 순서를 유지한다', () => {
    const words = [w('a', '2026-10-10T01:00:00Z'), w('b', '2026-10-11T01:00:00Z'), w('c', '2026-10-12T01:00:00Z')];
    const out = buildNewWords(words, new Set(['b']), now);
    expect(out.map((x) => x.key)).toEqual(['a', 'c']);
    expect(out[0]).toMatchObject({ term: 't-a', meaning: 'm-a', registeredDate: '2026-10-10' });
  });

  it('오늘 등록 여부는 KST 자정 기준이다', () => {
    const out = buildNewWords(
      [
        w('before', '2026-10-16T14:59:59Z'), // 10/16 23:59:59 KST
        w('after', '2026-10-16T15:00:00Z'), // 10/17 00:00 KST
      ],
      new Set(),
      now
    );
    expect(out).toEqual([
      expect.objectContaining({ key: 'before', registeredToday: false, registeredDate: '2026-10-16' }),
      expect.objectContaining({ key: 'after', registeredToday: true, registeredDate: '2026-10-17' }),
    ]);
  });

  it('모두 시험에 나왔으면 빈 배열', () => {
    expect(buildNewWords([w('a', '2026-10-10T01:00:00Z')], new Set(['a']), now)).toEqual([]);
  });
});
