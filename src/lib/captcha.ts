/**
 * Cloudflare Turnstile (Supabase Auth CAPTCHA) 설정.
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY 가 비어 있으면 위젯도 토큰도 쓰지 않는다(기존 동작 그대로).
 * 클라이언트·서버 양쪽에서 import 한다 — 비밀값 없음.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
export const CAPTCHA_ENABLED = TURNSTILE_SITE_KEY !== '';

export const CAPTCHA_WAITING_MESSAGE = '사람인지 확인하는 중이에요…';
export const CAPTCHA_FAILED_MESSAGE = '사람 확인이 실패했어요. 다시 시도해 주세요.';

/** Supabase 가 돌려주는 CAPTCHA 관련 오류인지 ("captcha protection: request disallowed …" 등) */
export function isCaptchaError(message: string | undefined | null): boolean {
  return (message ?? '').toLowerCase().includes('captcha');
}
