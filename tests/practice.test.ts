import { describe, expect, it } from 'vitest';
import { buildPracticeWords, type PracticeResultRow } from '@/lib/domain/practice';

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
