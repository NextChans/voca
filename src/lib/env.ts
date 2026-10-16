/** 공개 환경변수 (브라우저 번들 포함). NEXT_PUBLIC_* 는 빌드 시 인라인되므로 정적 참조해야 한다. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};
