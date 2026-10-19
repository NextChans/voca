import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/**
 * 1) Supabase 세션 쿠키 갱신 (Server Component 는 쿠키를 쓸 수 없으므로 여기서)
 * 2) 비로그인 사용자의 낙관적 리다이렉트. 실제 인가는 각 페이지/액션의 requireUser() 가 담당.
 *
 * 성능: 모든 요청(탭 프리페치 포함)이 지나가므로 Auth 서버 왕복 없이 getClaims() 로
 * JWT 를 로컬 검증한다(ES256, JWKS 캐시). 만료된 access token 은 getClaims 내부의
 * getSession 이 refresh token 으로 갱신해 setAll 로 쿠키에 다시 쓴다.
 * 폐기된 세션까지 확인하는 getUser() 는 서버 쪽 requireUser() 에서 요청당 1회만 한다.
 */
const PUBLIC_PATHS = new Set(['/login', '/privacy', '/terms']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // 공개 경로는 인증 확인 불필요 (로그인 페이지는 자체적으로 getUser 로 리다이렉트 판단)
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/auth/')) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;

  if (!signedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|jpg|svg|webp)$).*)'],
};
