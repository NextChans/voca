import { z } from 'zod';

export const WordsSchema = z.object({
  words: z.array(z.object({ term: z.string(), meaning: z.string() })),
});
export type OcrWords = z.infer<typeof WordsSchema>['words'];
export type OcrMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

/** 사용자에게 그대로 보여줄 수 있는 인식 실패 (status 는 HTTP 응답 코드) */
export class OcrError extends Error {
  /**
   * refundable: 공급자가 요청을 처리(과금)하지 않은 실패 — 레이트 리밋·인증·서버 오류 등.
   * 거부·토큰 초과·파싱 실패처럼 이미 처리된 호출은 false (사용자가 일부러 일으켜 한도를 우회하지 못하도록).
   */
  constructor(
    public readonly status: number,
    message: string,
    public readonly refundable = false
  ) {
    super(message);
  }
}
