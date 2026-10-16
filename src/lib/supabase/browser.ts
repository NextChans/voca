import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/** 브라우저에서는 로그인/로그아웃에만 사용한다 (DB 테이블은 RLS로 전면 차단). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
