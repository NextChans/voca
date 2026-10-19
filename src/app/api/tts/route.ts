import { NextResponse, type NextRequest } from 'next/server';
import { getUser } from '@/lib/server/auth';
import { serverEnv } from '@/lib/server/env';
import { TTS_DAILY_PER_FAMILY } from '@/lib/limits';
import { LEGAL_VERSION } from '@/lib/legal';
import * as repo from '@/lib/server/repo';

/**
 * GET /api/tts?item=<test_item_id>  — 시험 철자 문항 발음 (정답 철자를 브라우저에 보내지 않음)
 * GET /api/tts?text=<english>       — 기기에 영어 음성이 없을 때의 폴백
 *
 * Google Cloud TTS 로만 합성 (GOOGLE_TTS_API_KEY 없으면 503 → 클라이언트는 기기 음성만 사용).
 * 로그인한 가족 구성원만, 가족당 하루 TTS_DAILY_PER_FAMILY 회 (실패한 호출은 환불).
 */
const MAX_TEXT = 100;
const ENGLISH = /^[a-z][a-z\s'’\-./]*$/i;

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } });
}

async function synthesizeCloud(text: string, apiKey: string): Promise<ArrayBuffer> {
  const res = await fetch(
    'https://texttospeech.googleapis.com/v1/text:synthesize',
    {
      method: 'POST',
      // 키는 URL 이 아니라 헤더로 (프록시·로그에 남지 않도록)
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85 },
      }),
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) throw new Error(`Cloud TTS HTTP ${res.status}`);
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error('Cloud TTS returned no audio');
  const buf = Buffer.from(json.audioContent, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function GET(req: NextRequest) {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return error(403, 'forbidden');

  const user = await getUser();
  if (!user) return error(401, 'unauthorized');
  const member = await repo.getMembership(user.id);
  if (!member) return error(403, 'forbidden');
  // 약관 재동의 전에는 외부(국외) 전송이 있는 기능을 쓰지 않는다
  if (member.role === 'parent' && member.consent_version !== LEGAL_VERSION) return error(403, '약관 동의가 필요해요.');

  const params = req.nextUrl.searchParams;
  const itemId = params.get('item');
  let text: string | null;
  if (itemId) {
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) return error(400, 'invalid item');
    text = await repo.getItemTerm(member.family_id, itemId);
    if (!text) return error(404, 'not found');
  } else {
    text = (params.get('text') ?? '').trim();
    if (!text || text.length > MAX_TEXT || !ENGLISH.test(text)) return error(400, 'invalid text');
  }

  const key = serverEnv.googleTtsApiKey();
  if (!key) return error(503, 'tts not configured');
  try {
    await repo.consumeQuota(member.family_id, 'tts', TTS_DAILY_PER_FAMILY);
  } catch (e) {
    if (e instanceof repo.DomainError) return error(429, 'daily tts limit');
    throw e;
  }

  try {
    const audio = await synthesizeCloud(text, key);
    return new NextResponse(audio, {
      headers: {
        'content-type': 'audio/mpeg',
        // 문항 id 기반 URL 은 사용자 전용 → 공유 캐시 금지
        'cache-control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    await repo.refundQuota(member.family_id, 'tts');
    console.error('[api/tts] synthesis failed', e);
    return error(502, 'tts failed');
  }
}
