import { z } from 'zod';

export const WordsSchema = z.object({
  words: z.array(z.object({ term: z.string(), meaning: z.string() })),
});
export type OcrWords = z.infer<typeof WordsSchema>['words'];
export type OcrMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

/** 사용자에게 그대로 보여줄 수 있는 인식 실패 (status 는 HTTP 응답 코드) */
export class OcrError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}
