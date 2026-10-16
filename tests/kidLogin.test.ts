import { describe, expect, it } from 'vitest';
import { isValidLoginId, KID_EMAIL_DOMAIN, loginIdToEmail, toAuthEmail } from '@/lib/domain/kidLogin';

describe('kidLogin', () => {
  it('아이디 형식: 영어 소문자·숫자·_ 3~20자 (대문자 입력은 소문자로 정규화)', () => {
    expect(isValidLoginId('jiwoo')).toBe(true);
    expect(isValidLoginId('Ji_Woo2')).toBe(true);
    expect(isValidLoginId('ab')).toBe(false);
    expect(isValidLoginId('a'.repeat(21))).toBe(false);
    expect(isValidLoginId('ji-woo')).toBe(false);
    expect(isValidLoginId('지우')).toBe(false);
  });

  it('아이디는 메일이 발송되지 않는 예약 도메인 주소로 매핑된다', () => {
    expect(KID_EMAIL_DOMAIN.endsWith('.invalid')).toBe(true);
    expect(loginIdToEmail(' JiWoo ')).toBe(`jiwoo@${KID_EMAIL_DOMAIN}`);
  });

  it("로그인 입력: '@' 가 있으면 이메일 그대로, 없으면 자녀 아이디", () => {
    expect(toAuthEmail(' dad@example.com ')).toBe('dad@example.com');
    expect(toAuthEmail('Jiwoo')).toBe(`jiwoo@${KID_EMAIL_DOMAIN}`);
  });
});
