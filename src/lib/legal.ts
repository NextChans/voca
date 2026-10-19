// 개인정보 처리방침·이용약관과 동의 기록에서 함께 쓰는 상수.
// 문서 내용을 바꾸면 LEGAL_VERSION 을 올리고(=시행일), 필요하면 재동의를 받는다.

export const SERVICE_NAME = 'voca';

export const OPERATOR = { name: '장현찬', email: 'babadung@gmail.com' } as const;

/** 문서 시행일(YYYY-MM-DD, KST) */
export const LEGAL_EFFECTIVE_DATE = '2026-10-19';
/**
 * 동의 버전. 처리방침·약관 내용을 바꾸면 반드시 올린다 → 부모 전원 /consent 재동의.
 * 이력: 2026-10-19(최초) → 2026-10-19.2(국외 이전에 Cloudflare Turnstile, Vercel 방문 통계·시드니 리전 추가)
 */
export const LEGAL_VERSION = '2026-10-19.2';

// Supabase 대시보드(Project Settings → General) 기준 DB 리전 (2026-10-19 확인)
export const SUPABASE_REGION = '호주 시드니(AWS ap-southeast-2)';

export const CONSENT_KINDS = ['terms', 'privacy', 'overseas_transfer', 'guardian'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CONSENT_LABELS: Record<ConsentKind, string> = {
  terms: '이용약관 동의 (필수)',
  privacy: '개인정보 수집·이용 동의 (필수)',
  overseas_transfer: '개인정보 국외 이전 동의 (필수)',
  guardian: '만 14세 미만 자녀 개인정보 처리에 대한 법정대리인 동의 (필수)',
};

/** '2026-10-19' → '2026년 10월 19일' */
export function formatLegalDate(version: string = LEGAL_EFFECTIVE_DATE): string {
  const [y, m, d] = version.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
