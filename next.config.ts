import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// 브라우저는 Supabase Auth 엔드포인트만 호출한다 (로컬/커스텀 도메인 대응)
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return 'https://*.supabase.co';
  }
})();

// Cloudflare Turnstile(로그인·가입·비밀번호 재설정·탈퇴 CAPTCHA)은 challenges.cloudflare.com 의 스크립트·iframe 을 쓴다.
// NEXT_PUBLIC_TURNSTILE_SITE_KEY 가 없으면 로드되지 않지만 정책에는 항상 포함한다.
const turnstileOrigin = 'https://challenges.cloudflare.com';

// Tesseract.js(브라우저 OCR)는 jsDelivr에서 워커·WASM·언어데이터를 받아오므로 해당 출처만 추가 허용한다.
// 브라우저 OCR(Tesseract.js) 이 jsDelivr 에서 받는 경로만 허용 (jsDelivr 전체를 열면 임의 npm 스크립트 실행 가능)
// tesseract.js 버전을 올리면 함께 갱신할 것.
const TESSERACT_SCRIPT = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0/',
].join(' ');
const TESSERACT_CONNECT = `${TESSERACT_SCRIPT} https://cdn.jsdelivr.net/npm/@tesseract.js-data/`;

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: ${TESSERACT_SCRIPT} ${turnstileOrigin}${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  `connect-src 'self' ${supabaseOrigin} ${TESSERACT_CONNECT} ${turnstileOrigin}`,
  `frame-src ${turnstileOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // 사진 OCR 업로드 시 server action이 아니라 route handler를 쓰지만, 단어 일괄 저장 여유분 확보
    serverActions: { bodySizeLimit: '1mb' },
    // 탭 재방문 시 10초 동안은 클라이언트 캐시로 즉시 표시 (Next 15+ 기본 0초).
    // 내 액션은 revalidatePath 로 즉시 무효화되고, 다른 기기의 변경만 최대 10초 늦게 보인다.
    staleTimes: { dynamic: 10 },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
