/**
 * 자녀 로그인 아이디 ↔ Supabase Auth 이메일 매핑 (브라우저·서버 공용)
 * 자녀 계정에는 실제 이메일이 없으므로 예약 TLD(.invalid, RFC 2606)를 쓴 가상 주소로 저장한다.
 * 이 주소로는 메일이 절대 발송되지 않는다.
 */
export const KID_EMAIL_DOMAIN = 'kids.voca.invalid';
export const LOGIN_ID_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_KID_PASSWORD = 6;

export function normalizeLoginId(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidLoginId(input: string): boolean {
  return LOGIN_ID_RE.test(normalizeLoginId(input));
}

export function loginIdToEmail(loginId: string): string {
  return `${normalizeLoginId(loginId)}@${KID_EMAIL_DOMAIN}`;
}

/** 로그인 입력값: '@' 가 있으면 부모 이메일, 없으면 자녀 아이디 */
export function toAuthEmail(input: string): string {
  const v = input.trim();
  return v.includes('@') ? v : loginIdToEmail(v);
}
