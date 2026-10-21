/**
 * 자동 채점 규칙 (src/lib/domain/grading.ts) 단위 테스트
 */
import { describe, expect, it } from 'vitest';
import {
  gradeItem,
  gradeMeaning,
  gradeSpelling,
  meaningVariants,
  normalizeMeaning,
  normalizeSpelling,
  spellingVariants,
} from '@/lib/domain/grading';

describe('normalizeSpelling', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeSpelling('  Look   AFTER  ')).toBe('look after');
    expect(normalizeSpelling('look\tafter\n')).toBe('look after');
  });
  it('maps curly/modifier apostrophes and backtick to a straight apostrophe', () => {
    expect(normalizeSpelling('don’t')).toBe("don't");
    expect(normalizeSpelling('don‘t')).toBe("don't");
    expect(normalizeSpelling('donʼt')).toBe("don't");
    expect(normalizeSpelling('don`t')).toBe("don't");
  });
  it('maps unicode hyphens/dashes to ASCII hyphen', () => {
    expect(normalizeSpelling('well‐known')).toBe('well-known');
    expect(normalizeSpelling('well–known')).toBe('well-known');
  });
  it('strips trailing sentence punctuation', () => {
    expect(normalizeSpelling('apple.')).toBe('apple');
    expect(normalizeSpelling('apple!?')).toBe('apple');
    expect(normalizeSpelling('apple .')).toBe('apple');
  });
  it('applies NFKC (fullwidth letters)', () => {
    expect(normalizeSpelling('ＡＰＰＬＥ')).toBe('apple');
  });
});

describe('spellingVariants', () => {
  it('splits on slash and normalizes each', () => {
    expect(spellingVariants('Color / colour')).toEqual(['color', 'colour']);
  });
  it('drops empty variants', () => {
    expect(spellingVariants('apple / ')).toEqual(['apple']);
    expect(spellingVariants('')).toEqual([]);
  });
});

describe('gradeSpelling — 특수 문자', () => {
  it('특수 문자는 그대로 맞춰야 정답', () => {
    expect(gradeSpelling("o'clock", 'o’clock')).toBe(true);
    expect(gradeSpelling('T-shirt', 't-shirt')).toBe(true);
    expect(gradeSpelling('T-shirt', 'tshirt')).toBe(false);
    expect(gradeSpelling('rock & roll', 'rock & roll')).toBe(true);
    expect(gradeSpelling('Mr.', 'mr')).toBe(true);
  });
  it('물결(~)은 무시', () => {
    expect(gradeSpelling('be good at ~', 'be good at')).toBe(true);
    expect(gradeSpelling('be good at ~', 'be good at ~')).toBe(true);
    expect(gradeSpelling('~ing', 'ing')).toBe(true);
  });
});

describe('gradeSpelling', () => {
  it('accepts exact match', () => {
    expect(gradeSpelling('apple', 'apple')).toBe(true);
  });
  it('ignores case and surrounding / repeated whitespace', () => {
    expect(gradeSpelling('apple', '  APPLE ')).toBe(true);
    expect(gradeSpelling('look after', 'Look    after')).toBe(true);
  });
  it('treats curly apostrophe the same as straight one (both directions)', () => {
    expect(gradeSpelling("don't", 'don’t')).toBe(true);
    expect(gradeSpelling('don’t', "don't")).toBe(true);
  });
  it('ignores a trailing period', () => {
    expect(gradeSpelling('apple', 'apple.')).toBe(true);
  });
  it('accepts any slash variant', () => {
    expect(gradeSpelling('color / colour', 'color')).toBe(true);
    expect(gradeSpelling('color / colour', 'Colour')).toBe(true);
    expect(gradeSpelling('color / colour', 'colr')).toBe(false);
  });
  it('does not accept the whole variant string as an answer', () => {
    expect(gradeSpelling('color / colour', 'color / colour')).toBe(false);
  });
  it('rejects empty or whitespace-only / punctuation-only answers', () => {
    expect(gradeSpelling('apple', '')).toBe(false);
    expect(gradeSpelling('apple', '   ')).toBe(false);
    expect(gradeSpelling('apple', '.')).toBe(false);
  });
  it('rejects wrong spellings', () => {
    expect(gradeSpelling('apple', 'aple')).toBe(false);
    expect(gradeSpelling('apple', 'apples')).toBe(false);
    expect(gradeSpelling('look after', 'lookafter')).toBe(false);
  });
  it('does not ignore internal punctuation', () => {
    expect(gradeSpelling("don't", 'dont')).toBe(false);
  });
});

describe('normalizeMeaning', () => {
  it('removes spaces and punctuation', () => {
    expect(normalizeMeaning('행복 한')).toBe('행복한');
    expect(normalizeMeaning(' 사과! ')).toBe('사과');
  });
  it('removes tilde variants', () => {
    expect(normalizeMeaning('~에 대하여')).toBe('에대하여');
    expect(normalizeMeaning('∼에 대하여')).toBe('에대하여');
    expect(normalizeMeaning('〜에 대하여')).toBe('에대하여');
  });
  it('removes a leading list number', () => {
    expect(normalizeMeaning('1. 사과')).toBe('사과');
    expect(normalizeMeaning('  2) 능금')).toBe('능금');
  });
  it('keeps digits that are not a list number', () => {
    expect(normalizeMeaning('10대')).toBe('10대');
  });
  // BUG: NFKC 가 ① 을 "1" 로 바꾼 뒤에 번호 제거 정규식이 돌기 때문에 [①-⑳] 분기가 절대 매칭되지 않는다.
  it('removes a leading circled number (①)', () => {
    expect(normalizeMeaning('① 사과')).toBe('사과');
  });
});

describe('meaningVariants', () => {
  it('splits on , ; / · and newline', () => {
    expect(meaningVariants('사과, 능금; 과일 / 열매 · 빨강\n초록')).toEqual([
      '사과',
      '능금',
      '과일',
      '열매',
      '빨강',
      '초록',
    ]);
  });
  it('splits on fullwidth / CJK separators', () => {
    expect(meaningVariants('사과，능금、과일；열매')).toEqual(['사과', '능금', '과일', '열매']);
  });
  it('strips parenthetical / bracket notes', () => {
    expect(meaningVariants('(과일) 사과')).toEqual(['사과']);
    expect(meaningVariants('[동사] 돌보다')).toEqual(['돌보다']);
    expect(meaningVariants('사과（과일）')).toEqual(['사과']);
    expect(meaningVariants('<명> 사과')).toEqual(['사과']);
  });
  it('uses the bracket content when a part is only brackets', () => {
    expect(meaningVariants('사과, (능금)')).toEqual(['사과', '능금']);
  });
  it('removes list numbers on each part', () => {
    expect(meaningVariants('1. 사과, 2. 능금')).toEqual(['사과', '능금']);
  });
  it('dedupes', () => {
    expect(meaningVariants('사과, 사과, 사 과')).toEqual(['사과']);
  });
  it('returns empty list for empty input', () => {
    expect(meaningVariants('')).toEqual([]);
    expect(meaningVariants(' , ; ')).toEqual([]);
  });
});

describe('gradeMeaning', () => {
  it('accepts any single registered meaning', () => {
    expect(gradeMeaning('사과, 능금', '사과')).toBe(true);
    expect(gradeMeaning('사과, 능금', '능금')).toBe(true);
    expect(gradeMeaning('사과; 능금', '능금')).toBe(true);
    expect(gradeMeaning('사과 / 능금', '능금')).toBe(true);
    expect(gradeMeaning('사과 · 능금', '능금')).toBe(true);
  });
  it('ignores parenthetical notes in the registered meaning', () => {
    expect(gradeMeaning('(과일) 사과', '사과')).toBe(true);
  });
  it('ignores parenthetical notes in the answer', () => {
    expect(gradeMeaning('사과', '사과(과일)')).toBe(true);
  });
  it('handles numbered meanings "1. 사과, 2. 능금"', () => {
    expect(gradeMeaning('1. 사과, 2. 능금', '사과')).toBe(true);
    expect(gradeMeaning('1. 사과, 2. 능금', '능금')).toBe(true);
    expect(gradeMeaning('1. 사과, 2. 능금', '2. 능금')).toBe(true);
  });
  it('ignores tilde', () => {
    expect(gradeMeaning('~에 대하여', '에 대하여')).toBe(true);
    expect(gradeMeaning('~에 대하여', '~에 대하여')).toBe(true);
    expect(gradeMeaning('에 대하여', '~에대하여')).toBe(true);
  });
  it('ignores spaces inside Korean', () => {
    expect(gradeMeaning('행복한', '행복 한')).toBe(true);
    expect(gradeMeaning('행복 한', '행복한')).toBe(true);
  });
  it('ignores punctuation', () => {
    expect(gradeMeaning('사과', '사과.')).toBe(true);
  });
  it('accepts multiple answer parts when all are correct', () => {
    expect(gradeMeaning('사과, 능금', '사과, 능금')).toBe(true);
    expect(gradeMeaning('사과, 능금', '능금 / 사과')).toBe(true);
  });
  it('rejects when any answer part is wrong (anti-shotgun rule)', () => {
    expect(gradeMeaning('사과, 능금', '사과, 배')).toBe(false);
    expect(gradeMeaning('사과', '배, 사과, 포도')).toBe(false);
  });
  it('ignores empty answer parts from stray separators', () => {
    expect(gradeMeaning('사과, 능금', '사과,')).toBe(true);
    expect(gradeMeaning('사과, 능금', ', 사과 ,, ')).toBe(true);
  });
  it('rejects empty / whitespace / separator-only answers', () => {
    expect(gradeMeaning('사과', '')).toBe(false);
    expect(gradeMeaning('사과', '   ')).toBe(false);
    expect(gradeMeaning('사과', ', ; /')).toBe(false);
    expect(gradeMeaning('사과', '~')).toBe(false);
  });
  it('rejects wrong meanings and partial matches', () => {
    expect(gradeMeaning('사과', '배')).toBe(false);
    expect(gradeMeaning('행복한', '행복')).toBe(false);
    expect(gradeMeaning('사과', '사과나무')).toBe(false);
  });
  it('does not accept two meanings written without a separator', () => {
    expect(gradeMeaning('사과, 능금', '사과 능금')).toBe(false);
  });
  // BUG: 원문자 번호(①②)가 붙은 등록 뜻은 NFKC 후 "1사과" 가 되어 "사과" 를 정답으로 인정하지 못한다.
  it('handles circled-number meanings "① 사과, ② 능금"', () => {
    expect(gradeMeaning('① 사과, ② 능금', '사과')).toBe(true);
  });
});

describe('gradeItem', () => {
  const item = { term: 'color / colour', meaning: '(명사) 색, 색깔' };
  it('dispatches spelling direction to the term', () => {
    expect(gradeItem({ ...item, direction: 'spelling' }, 'Colour')).toBe(true);
    expect(gradeItem({ ...item, direction: 'spelling' }, '색깔')).toBe(false);
  });
  it('dispatches meaning direction to the meaning', () => {
    expect(gradeItem({ ...item, direction: 'meaning' }, '색 깔')).toBe(true);
    expect(gradeItem({ ...item, direction: 'meaning' }, 'color')).toBe(false);
  });
  it('rejects empty answers in both directions', () => {
    expect(gradeItem({ ...item, direction: 'spelling' }, '')).toBe(false);
    expect(gradeItem({ ...item, direction: 'meaning' }, '')).toBe(false);
  });
});
