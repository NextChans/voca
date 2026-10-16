import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/server/auth';
import { activeOcrProvider, extractWords, OcrError } from '@/lib/server/ocr';
import * as repo from '@/lib/server/repo';

/**
 * POST /api/ocr  { image: base64, mediaType }  → { words: [{ term, meaning }] }
 *
 * 단어장 사진에서 영어 단어 + 한글 뜻을 AI 로 추출한다. 이미지는 저장하지 않는다.
 * 가족 구성원(부모·자녀)만 호출 가능.
 * GEMINI_API_KEY → Gemini, 없으면 ANTHROPIC_API_KEY → Claude, 둘 다 없으면 501 (브라우저 OCR 사용).
 */
export const maxDuration = 60;

const MAX_BASE64 = 6 * 1024 * 1024; // ≈ 4.5MB 이미지
const MAX_WORDS = 300;
const TERM = /^[a-z][a-z\s'’\-./]*$/i;

const BodySchema = z.object({
  image: z
    .string()
    .min(1)
    .max(MAX_BASE64)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return error(403, 'forbidden');

  const user = await getUser();
  if (!user) return error(401, '로그인이 필요해요.');
  const member = await repo.getMembership(user.id);
  if (!member) return error(403, 'forbidden');

  if (!activeOcrProvider()) return error(501, 'AI 사진 인식이 설정되지 않았어요.');

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return error(400, '사진 형식이 올바르지 않아요. (JPG/PNG/WEBP, 최대 약 4MB)');
  }

  try {
    const raw = await extractWords(body.image, body.mediaType);
    const seen = new Set<string>();
    const words: { term: string; meaning: string }[] = [];
    for (const w of raw) {
      const term = w.term.normalize('NFKC').replace(/\s+/g, ' ').trim();
      const meaning = w.meaning
        .replace(/(^|[\s,])[㉠-㉿ⓐ-ⓩ]\s*/gu, '$1') // 동그라미 품사 기호가 남은 경우 제거
        .replace(/\s+/g, ' ')
        .replace(/^[,\s]+|[,\s]+$/g, '')
        .trim();
      if (!term || !meaning || term.length > 100 || meaning.length > 200 || !TERM.test(term)) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({ term, meaning });
      if (words.length >= MAX_WORDS) break;
    }
    return NextResponse.json({ words }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof OcrError) return error(e.status, e.message);
    console.error('[api/ocr] unexpected error', e);
    return error(502, '사진 인식 중 문제가 생겼어요.');
  }
}
