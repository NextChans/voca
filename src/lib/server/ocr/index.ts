import 'server-only';
import { serverEnv } from '@/lib/server/env';
import { extractWithClaude } from './claude';
import { DEFAULT_GEMINI_MODEL, extractWithGemini } from './gemini';
import type { OcrMediaType, OcrWords } from './types';

export { OcrError } from './types';

export type OcrProvider = 'gemini' | 'claude';

/** GEMINI_API_KEY(무료 등급 가능) 우선, 없으면 ANTHROPIC_API_KEY, 둘 다 없으면 null(브라우저 OCR) */
export function activeOcrProvider(): OcrProvider | null {
  if (serverEnv.geminiApiKey()) return 'gemini';
  if (serverEnv.anthropicApiKey()) return 'claude';
  return null;
}

export async function extractWords(image: string, mediaType: OcrMediaType): Promise<OcrWords> {
  const gemini = serverEnv.geminiApiKey();
  if (gemini) return extractWithGemini(gemini, serverEnv.geminiModel() ?? DEFAULT_GEMINI_MODEL, image, mediaType);
  const claude = serverEnv.anthropicApiKey();
  if (claude) return extractWithClaude(claude, image, mediaType);
  throw new Error('no OCR provider configured');
}
