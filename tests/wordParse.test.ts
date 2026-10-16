/**
 * 단어 목록 파서 (src/lib/domain/wordParse.ts) 단위 테스트
 */
import { describe, expect, it } from 'vitest';
import { parseWordLine, parseWordList } from '@/lib/domain/wordParse';

describe('parseWordLine — supported formats', () => {
  it('"apple 사과" (English then Korean)', () => {
    expect(parseWordLine('apple 사과')).toEqual({ term: 'apple', meaning: '사과' });
  });
  it('"apple - 사과" (spaced dash)', () => {
    expect(parseWordLine('apple - 사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('apple – 사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('apple — 사과')).toEqual({ term: 'apple', meaning: '사과' });
  });
  it('"apple: 사과", "apple : 사과", "apple = 사과", "apple | 사과"', () => {
    expect(parseWordLine('apple: 사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('apple : 사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('apple=사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('apple | 사과')).toEqual({ term: 'apple', meaning: '사과' });
  });
  it('tab separated', () => {
    expect(parseWordLine('apple\t사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('look after\t돌보다, 보살피다')).toEqual({ term: 'look after', meaning: '돌보다, 보살피다' });
  });
  it('strips leading list numbers and bullets', () => {
    expect(parseWordLine('1. apple 사과, 능금')).toEqual({ term: 'apple', meaning: '사과, 능금' });
    expect(parseWordLine('12) apple 사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('(3) apple 사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('- apple 사과')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('• apple 사과')).toEqual({ term: 'apple', meaning: '사과' });
  });
  it('"사과 apple" (Korean then English) is flipped', () => {
    expect(parseWordLine('사과 apple')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('돌보다 look after')).toEqual({ term: 'look after', meaning: '돌보다' });
  });
  it('"사과 - apple" with explicit separator is flipped', () => {
    expect(parseWordLine('사과 - apple')).toEqual({ term: 'apple', meaning: '사과' });
    expect(parseWordLine('사과\tapple')).toEqual({ term: 'apple', meaning: '사과' });
  });
  it('multi-word phrases', () => {
    expect(parseWordLine('look after 돌보다')).toEqual({ term: 'look after', meaning: '돌보다' });
    expect(parseWordLine('give up 포기하다')).toEqual({ term: 'give up', meaning: '포기하다' });
  });
  it('hyphenated and apostrophe terms', () => {
    expect(parseWordLine('well-known 잘 알려진')).toEqual({ term: 'well-known', meaning: '잘 알려진' });
    expect(parseWordLine("o'clock 시")).toEqual({ term: "o'clock", meaning: '시' });
  });
  it('collapses whitespace', () => {
    expect(parseWordLine('  look    after    돌보다   ')).toEqual({ term: 'look after', meaning: '돌보다' });
  });
  it('applies NFKC (fullwidth letters)', () => {
    expect(parseWordLine('ａｐｐｌｅ 사과')).toEqual({ term: 'apple', meaning: '사과' });
  });
});

describe('parseWordLine — rejected lines', () => {
  it('blank lines', () => {
    expect(parseWordLine('')).toBeNull();
    expect(parseWordLine('   \t ')).toBeNull();
  });
  it('lines with only one language', () => {
    expect(parseWordLine('apple')).toBeNull();
    expect(parseWordLine('hello world')).toBeNull();
    expect(parseWordLine('사과')).toBeNull();
  });
  it('garbage', () => {
    expect(parseWordLine('12345')).toBeNull();
    expect(parseWordLine('---')).toBeNull();
    expect(parseWordLine('!!!')).toBeNull();
  });
});

describe('parseWordList', () => {
  it('parses a mixed block and skips blank / garbage lines', () => {
    const text = [
      'Unit 3 Words',
      '',
      '1. apple 사과, 능금',
      '2. banana - 바나나',
      '   ',
      'cherry: 체리',
      'grape\t포도',
      '수박 watermelon',
      '###',
      '3. look after 돌보다',
      '12345',
    ].join('\n');
    expect(parseWordList(text)).toEqual([
      { term: 'apple', meaning: '사과, 능금' },
      { term: 'banana', meaning: '바나나' },
      { term: 'cherry', meaning: '체리' },
      { term: 'grape', meaning: '포도' },
      { term: 'watermelon', meaning: '수박' },
      { term: 'look after', meaning: '돌보다' },
    ]);
  });
  it('handles CRLF line endings', () => {
    expect(parseWordList('apple 사과\r\nbanana 바나나\r\n')).toEqual([
      { term: 'apple', meaning: '사과' },
      { term: 'banana', meaning: '바나나' },
    ]);
  });
  it('dedupes terms case-insensitively, keeping the first', () => {
    expect(parseWordList('Apple 사과\napple 능금\nAPPLE: 사과나무')).toEqual([{ term: 'Apple', meaning: '사과' }]);
  });
  it('ignores lines whose term contains digits or Korean', () => {
    expect(parseWordList('Chapter 1 제1장')).toEqual([]);
  });
  it('ignores lines with no Korean (no separator)', () => {
    expect(parseWordList('hello world\nfoo bar baz')).toEqual([]);
  });
  // BUG: 명시적 구분자(: = | - TAB)가 있으면 양쪽 모두 한글이 없어도 단어로 받아들인다 (OCR 머리글 "Name: ____" 등).
  it('ignores lines with no Korean even with an explicit separator', () => {
    expect(parseWordList('Unit: Animals\nName: ____\napple: banana')).toEqual([]);
  });
  // BUG: NFKC 가 ① → "1" 로 바꾼 뒤 번호 제거가 돌아 term 이 "1apple" 이 되어 줄 전체가 버려진다.
  it('strips circled numbers "① apple 사과"', () => {
    expect(parseWordList('① apple 사과\n② banana 바나나')).toEqual([
      { term: 'apple', meaning: '사과' },
      { term: 'banana', meaning: '바나나' },
    ]);
  });
  // BUG: 단어장에 흔한 "be good at ~을 잘하다" 형태에서 물결이 term 쪽에 붙어 term 검증에 실패 → 줄 전체가 버려진다.
  it('keeps tilde with the meaning: "be good at ~을 잘하다"', () => {
    expect(parseWordList('be good at ~을 잘하다')).toEqual([{ term: 'be good at', meaning: '~을 잘하다' }]);
  });
  // BUG: 뜻 안의 콜론(예: ...)이 명시적 구분자로 오인돼 term 이 "apple 사과 (예" 가 되고 줄 전체가 버려진다.
  it('a colon inside the meaning does not break parsing', () => {
    expect(parseWordList('apple 사과 (예: 빨간 사과)')).toEqual([{ term: 'apple', meaning: '사과 (예: 빨간 사과)' }]);
  });
  it('returns [] for empty input', () => {
    expect(parseWordList('')).toEqual([]);
    expect(parseWordList('\n\n\n')).toEqual([]);
  });
});
