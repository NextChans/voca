import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

// 목 서버: 첫 모델은 404, 두 번째 모델은 스키마 거부(400), 스키마 없이 호출하면 코드블록 JSON 응답
const calls: { model: string; schema: boolean }[] = [];
let server: http.Server;
let port = 0;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const model = /models\/([^:]+):/.exec(req.url ?? '')?.[1] ?? '';
      const schema = Boolean(JSON.parse(body).generationConfig?.responseJsonSchema);
      calls.push({ model, schema });
      res.setHeader('content-type', 'application/json');
      if (model === 'bad-model') {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: { code: 404, message: 'models/bad-model is not found', status: 'NOT_FOUND' } }));
      }
      if (schema) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: { code: 400, message: 'Invalid JSON payload: unknown field responseJsonSchema', status: 'INVALID_ARGUMENT' } }));
      }
      res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: '```json\n{"words":[{"term":"handle","meaning":"손잡이, 다루다"}]}\n```' }] }, finishReason: 'STOP' }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());

describe('gemini fallback', () => {
  it('모델 404 → 다음 모델, 스키마 400 → 스키마 없이 재시도, 코드블록 JSON 파싱', async () => {
    const { extractWithGemini } = await import('@/lib/server/ocr/gemini');
    const words = await extractWithGemini('k', 'bad-model', 'AAAA', 'image/jpeg', `http://127.0.0.1:${port}`);
    expect(words).toEqual([{ term: 'handle', meaning: '손잡이, 다루다' }]);
    expect(calls).toEqual([
      { model: 'bad-model', schema: true },
      { model: 'gemini-3.5-flash-lite', schema: true },
      { model: 'gemini-3.5-flash-lite', schema: false },
    ]);
  });
});
