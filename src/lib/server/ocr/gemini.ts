import 'server-only';
import { ApiError, GoogleGenAI } from '@google/genai';
import { PROMPT, WORDS_JSON_SCHEMA } from './prompt';
import { OcrError, WordsSchema, type OcrMediaType, type OcrWords } from './types';

/** 무료 등급이 있는 Flash 계열. GEMINI_MODEL 로 변경 가능 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
/** 지정 모델을 못 찾을 때(404 등) 순서대로 시도할 대체 모델 */
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];

const JSON_ONLY_SUFFIX =
  '\n\n반드시 다른 설명 없이 {"words":[{"term":"...","meaning":"..."}]} 형식의 JSON 만 출력하세요.';

/** 응답 텍스트에서 JSON 부분만 추출 (```json 코드블록 등 대응) */
function parseWordsJson(text: string): OcrWords {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new OcrError(502, '사진에서 단어를 읽지 못했어요.');
  const parsed = WordsSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
  if (!parsed.success) throw new OcrError(502, '사진에서 단어를 읽지 못했어요.');
  return parsed.data.words;
}

async function callOnce(
  ai: GoogleGenAI,
  model: string,
  image: string,
  mediaType: OcrMediaType,
  structured: boolean
): Promise<OcrWords> {
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: mediaType, data: image } },
          { text: structured ? PROMPT : PROMPT + JSON_ONLY_SUFFIX },
        ],
      },
    ],
    config: structured
      ? { responseMimeType: 'application/json', responseJsonSchema: WORDS_JSON_SCHEMA }
      : { responseMimeType: 'application/json' },
  });
  const text = res.text;
  if (!text) {
    const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason;
    if (reason === 'MAX_TOKENS') throw new OcrError(422, '단어가 너무 많아요. 사진을 나눠서 찍어 주세요.');
    throw new OcrError(422, `이 사진은 인식할 수 없어요. 다른 사진으로 시도해 주세요. (${reason ?? 'empty'})`);
  }
  return parseWordsJson(text);
}

export async function extractWithGemini(
  apiKey: string,
  model: string,
  image: string,
  mediaType: OcrMediaType,
  /** 테스트용 엔드포인트 교체 */
  baseUrl?: string
): Promise<OcrWords> {
  const ai = new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
  const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let structured = true;
  let lastError: unknown;

  for (let i = 0; i < models.length; ) {
    const current = models[i]!;
    try {
      return await callOnce(ai, current, image, mediaType, structured);
    } catch (e) {
      lastError = e;
      if (e instanceof OcrError) throw e;
      if (e instanceof SyntaxError) throw new OcrError(502, '사진에서 단어를 읽지 못했어요.');
      if (!(e instanceof ApiError)) throw e;

      console.error('[ocr/gemini] api error', { model: current, structured, status: e.status, message: e.message });
      if (e.status === 429) {
        throw new OcrError(429, '무료 사용량을 넘었거나 요청이 많아요. 잠시 후 다시 시도해 주세요. (Gemini 429)');
      }
      if (e.status === 401 || e.status === 403 || /api key|API_KEY/i.test(e.message)) {
        throw new OcrError(502, `AI 키가 올바르지 않아요. Vercel 의 GEMINI_API_KEY 를 확인해 주세요. (Gemini ${e.status})`);
      }
      // 구조화 출력 옵션 거부 → 같은 모델로 옵션 없이 재시도
      if (e.status === 400 && structured && /schema|response_?json|responseJsonSchema|mime/i.test(e.message)) {
        structured = false;
        continue;
      }
      // 모델 없음/미지원 → 다음 모델
      if (e.status === 404 || (e.status === 400 && /model/i.test(e.message))) {
        i++;
        structured = true;
        continue;
      }
      break;
    }
  }

  const status = lastError instanceof ApiError ? lastError.status : 'unknown';
  throw new OcrError(502, `사진 인식 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요. (Gemini ${status})`);
}
