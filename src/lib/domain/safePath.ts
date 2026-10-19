/**
 * 같은 사이트 내부 경로만 허용 (오픈 리다이렉트 방지).
 * 문자열 비교 대신 WHATWG URL 파서로 해석해 origin 이 바뀌는지 본다.
 * (예: '/\t/evil.com', '/\\evil.com', '//evil.com' 은 브라우저가 외부 주소로 해석)
 */
export function safeInternalPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  try {
    const base = 'https://internal.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
