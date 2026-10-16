import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/server/auth';
import { serverEnv } from '@/lib/server/env';
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

const PROMPT = `이 사진은 초등학생 영어 단어 교재(단어장) 페이지입니다. 펼친 두 페이지나 2단 편집일 수 있습니다.
교재의 "표제어"(외워야 할 영어 단어)와 그 대표 한국어 뜻만 추출해 주세요.

교재 형식 예시 (사전형 단어장):
  312                       ← 표제어 번호
  handle   명 손잡이 동 다루다     ← 굵은 표제어 + 품사 기호 + 뜻  ★이 줄만 추출
  [hǽndl]  · He turned the handle to the right.   ← 발음기호, 예문 (제외)
           그는 손잡이를 오른쪽으로 돌렸다.          ← 예문 해석 (제외)
           반 war 전쟁 / 형 peaceful 평화로운 / 참고 college …  ← 반의어·파생어·참고 (제외)
→ { "term": "handle", "meaning": "손잡이, 다루다" }

규칙:
- term: 굵고 큰 글씨의 표제어만. 고유명사가 아니면 소문자. 숙어 표제어(예: look after)는 그대로.
- meaning: 표제어 바로 옆 줄의 한국어 뜻을 사진에 적힌 그대로 옮기고, 품사 기호(명·동·형·부·전·접 등 동그라미 글자)는 빼고 쉼표로 이어 씁니다.
  예: "명 힘, 강점" → "힘, 강점",  "명 상 동 주다, 수여하다" → "상, 주다, 수여하다"
  뜻 안의 괄호 설명은 유지합니다. 예: "하이킹, (산과 들로 가는) 도보여행"
- 제외: 예문과 그 해석, 발음기호, 반의어·유의어·파생어(반/유/동/형 등으로 시작해 예문 아래에 붙은 줄), 참고/Tip 박스, DAY 제목, QR코드, 페이지 번호·머리글·꼬리글, 비쳐 보이는 뒷면 글자.
- 읽는 순서: 왼쪽 페이지(왼쪽 단) 위→아래, 그다음 오른쪽 페이지(오른쪽 단) 위→아래. 표제어 번호 순서와 같게.
- 사진 가장자리에서 잘려 표제어나 뜻을 확실히 읽을 수 없는 항목은 제외합니다.
- 흐릿한 글자는 문맥으로 바로잡되, 사진에 없는 단어나 뜻을 지어내지 않습니다.
- 표제어가 없는 일반 단어 목록("apple 사과" 형식)이면 각 줄의 단어와 뜻을 그대로 추출합니다.`;

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
      // 2단·사전형 레이아웃 판단이 필요해 medium (사진 1장당 수 센트 수준)
      output_config: { effort: 'medium', format: betaZodOutputFormat(WordsSchema) },
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
