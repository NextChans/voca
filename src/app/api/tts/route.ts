import { NextResponse, type NextRequest } from 'next/server';
import { getUser } from '@/lib/server/auth';
import { serverEnv } from '@/lib/server/env';
import * as repo from '@/lib/server/repo';

/**
 * GET /api/tts?item=<test_item_id>  — 시험 철자 문항 발음 (정답 철자를 브라우저에 보내지 않음)
 * GET /api/tts?text=<english>       — 기기에 영어 음성이 없을 때의 폴백
 *
 * GOOGLE_TTS_API_KEY 가 있으면 Google Cloud TTS(공식), 없으면 Google Translate TTS(비공식)로 합성.
 * 로그인한 가족 구성원만 호출 가능 (무료 TTS 프록시 악용 방지).
 */
const MAX_TEXT = 100;
const ENGLISH = /^[a-z][a-z\s'’\-./]*$/i;

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } });
}

async function synthesizeCloud(text: string, apiKey: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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

async function synthesizeTranslate(text: string): Promise<ArrayBuffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&ttsspeed=0.8&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Voca TTS proxy)' },
    signal: AbortSignal.timeout(8000),
  });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('audio')) throw new Error(`Translate TTS HTTP ${res.status} (${type})`);
  return res.arrayBuffer();
}

export async function GET(req: NextRequest) {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return error(403, 'forbidden');

  const user = await getUser();
  if (!user) return error(401, 'unauthorized');
  const member = await repo.getMembership(user.id);
  if (!member) return error(403, 'forbidden');

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

  try {
    const key = serverEnv.googleTtsApiKey();
    const audio = key ? await synthesizeCloud(text, key) : await synthesizeTranslate(text);
    return new NextResponse(audio, {
      headers: {
        'content-type': 'audio/mpeg',
        // 문항 id 기반 URL 은 사용자 전용 → 공유 캐시 금지
        'cache-control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error('[api/tts] synthesis failed', e);
    return error(502, 'tts failed');
  }
}
