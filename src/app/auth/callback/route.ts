import { NextResponse, type NextRequest } from 'next/server';
import { safeInternalPath } from '@/lib/domain/safePath';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const safeNext = (next: string | null) => safeInternalPath(next, '/');

/** 이메일 인증 링크 → 세션 교환 후 이동 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error('[auth/callback] exchangeCodeForSession failed', error.message);
  }
  return NextResponse.redirect(new URL('/login?error=link', origin));
}
