import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/server/auth';
import { serverEnv } from '@/lib/server/env';
import { isParentMode } from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';

/**
 * POST /api/ocr  { image: base64, mediaType }  → { words: [{ term, meaning }] }
 *
 * 단어장 사진에서 영어 단어 + 한글 뜻을 Claude 로 추출한다. 이미지는 저장하지 않는다.
 * 부모 모드의 가족 구성원만 호출 가능. ANTHROPIC_API_KEY 가 없으면 501 (브라우저 OCR 사용).
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

const WordsSchema = z.object({
  words: z.array(z.object({ term: z.string(), meaning: z.string() })),
});

const PROMPT = `이 사진은 초등학생용 영어 단어장 또는 교과서 페이지입니다.
사진에 있는 영어 단어(또는 짧은 숙어)와 그 한국어 뜻을 모두 추출해 주세요.

규칙:
- term: 영어 단어/숙어. 고유명사가 아니면 소문자로 씁니다.
- meaning: 사진에 적힌 한국어 뜻을 그대로 옮깁니다. 뜻이 여러 개면 쉼표(, )로 구분합니다.
- 예문, 발음기호, 품사 표시만 있는 줄, 페이지 번호, 제목/머리글, 번호는 제외합니다.
- 명백한 인식 잡음(깨진 글자 등)은 바로잡되, 사진에 없는 단어나 뜻을 지어내지 않습니다.
- 뜻이 사진에 없는 단어는 제외합니다.
- 사진의 순서를 유지합니다.`;

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
  if (!(await isParentMode(user.id, member.family_id))) {
    return error(403, '부모 모드에서만 사용할 수 있어요.');
  }

  const apiKey = serverEnv.anthropicApiKey();
  if (!apiKey) return error(501, 'AI 사진 인식이 설정되지 않았어요.');

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return error(400, '사진 형식이 올바르지 않아요. (JPG/PNG/WEBP, 최대 약 4MB)');
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(WordsSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: body.mediaType, data: body.image } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });

    if (res.stop_reason === 'refusal') {
      return error(422, '이 사진은 인식할 수 없어요. 다른 사진으로 시도해 주세요.');
    }
    if (res.stop_reason === 'max_tokens') {
      return error(422, '단어가 너무 많아요. 사진을 나눠서 찍어 주세요.');
    }
    const parsed = res.parsed_output;
    if (!parsed) return error(502, '사진에서 단어를 읽지 못했어요.');

    const seen = new Set<string>();
    const words: { term: string; meaning: string }[] = [];
    for (const w of parsed.words) {
      const term = w.term.normalize('NFKC').replace(/\s+/g, ' ').trim();
      const meaning = w.meaning.replace(/\s+/g, ' ').trim();
      if (!term || !meaning || term.length > 100 || meaning.length > 200 || !TERM.test(term)) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({ term, meaning });
      if (words.length >= MAX_WORDS) break;
    }
    return NextResponse.json({ words }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return error(429, '요청이 많아요. 잠시 후 다시 시도해 주세요.');
    }
    if (e instanceof Anthropic.APIError) {
      console.error('[api/ocr] anthropic error', e.status, e.message);
      return error(502, '사진 인식 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
    }
    console.error('[api/ocr] unexpected error', e);
    return error(502, '사진 인식 중 문제가 생겼어요.');
  }
}
