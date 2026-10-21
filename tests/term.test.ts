import { describe, expect, it } from 'vitest';
import { isValidTerm } from '@/lib/domain/term';

describe('isValidTerm', () => {
  it.each([
    'apple',
    "o'clock",
    'o’clock',
    'T-shirt',
    'Mr.',
    'U.S.A.',
    'rock & roll',
    '(be) good at',
    'be good at ~',
    'What’s up?',
    'Wow!',
    'e-mail',
    'café',
    'naïve',
    'color / colour',
    '~ing',
    '"quote"',
    '#hashtag @home',
  ])('허용: %s', (t) => expect(isValidTerm(t)).toBe(true));

  it.each([
    '',
    '123',
    'Chapter 1',
    '100% sure',
    '!!!',
    '사과',
    'apple 사과',
    'ㅋapple',
    'яблоко',
    'apple\nbanana',
    'tab\there',
    'a'.repeat(101),
  ])('거부: %j', (t) => expect(isValidTerm(t)).toBe(false));
});
