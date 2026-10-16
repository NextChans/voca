import 'server-only';
import { ApiError, GoogleGenAI } from '@google/genai';
import { PROMPT, WORDS_JSON_SCHEMA } from './prompt';
import { OcrError, WordsSchema, type OcrMediaType, type OcrWords } from './types';

/** 무료 등급이 있는 Flash 계열. GEMINI_MODEL 로 변경 가능 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export async function extractWithGemini(
  apiKey: string,
  model: string,
  image: string,
  mediaType: OcrMediaType
): Promise<OcrWords> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: mediaType, data: image } }, { text: PROMPT }],
        },
      ],
      config: { responseMimeType: 'application/json', responseJsonSchema: WORDS_JSON_SCHEMA },
    });
    const text = res.text;
    if (!text) {
      const reason = res.candidates?.[0]?.finishReason;
      if (reason === 'MAX_TOKENS') throw new OcrError(422, '단어가 너무 많아요. 사진을 나눠서 찍어 주세요.');
      throw new OcrError(422, '이 사진은 인식할 수 없어요. 다른 사진으로 시도해 주세요.');
    }
    const parsed = WordsSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new OcrError(502, '사진에서 단어를 읽지 못했어요.');
    return parsed.data.words;
  } catch (e) {
    if (e instanceof OcrError) throw e;
    if (e instanceof ApiError) {
      console.error('[ocr/gemini] api error', e.status, e.message);
      if (e.status === 429) throw new OcrError(429, '오늘 무료 사용량을 넘었거나 요청이 많아요. 잠시 후 다시 시도해 주세요.');
      throw new OcrError(502, '사진 인식 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
    }
    if (e instanceof SyntaxError) throw new OcrError(502, '사진에서 단어를 읽지 못했어요.');
    throw e;
  }
}
