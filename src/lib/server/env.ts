import 'server-only';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다.`);
  return v;
}

export const serverEnv = {
  serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  appSecret: () => {
    const v = required('APP_SECRET');
    if (v.length < 32) throw new Error('APP_SECRET 은 32자 이상이어야 합니다.');
    return v;
  },
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY || null,
  googleTtsApiKey: () => process.env.GOOGLE_TTS_API_KEY || null,
};
