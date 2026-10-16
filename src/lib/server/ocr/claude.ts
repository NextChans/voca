import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { PROMPT } from './prompt';
import { OcrError, WordsSchema, type OcrMediaType, type OcrWords } from './types';

export async function extractWithClaude(apiKey: string, image: string, mediaType: OcrMediaType): Promise<OcrWords> {
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
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });
    if (res.stop_reason === 'refusal') throw new OcrError(422, '이 사진은 인식할 수 없어요. 다른 사진으로 시도해 주세요.');
    if (res.stop_reason === 'max_tokens') throw new OcrError(422, '단어가 너무 많아요. 사진을 나눠서 찍어 주세요.');
    if (!res.parsed_output) throw new OcrError(502, '사진에서 단어를 읽지 못했어요.');
    return res.parsed_output.words;
  } catch (e) {
    if (e instanceof OcrError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new OcrError(429, '요청이 많아요. 잠시 후 다시 시도해 주세요.');
    if (e instanceof Anthropic.APIError) {
      console.error('[ocr/claude] api error', e.status, e.message);
      throw new OcrError(502, '사진 인식 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
    }
    throw e;
  }
}
