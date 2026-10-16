import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server/env';

let client: SupabaseClient | null = null;

/**
 * service_role 클라이언트 (RLS 우회). 서버 전용.
 * 반드시 requireUser() 로 검증한 user.id 로 범위를 한정해서 사용할 것 — repo 계층에서 강제.
 */
export function supabaseAdmin(): SupabaseClient {
  client ??= createClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
