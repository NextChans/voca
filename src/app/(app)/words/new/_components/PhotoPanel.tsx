'use client';

import { useEffect, useRef, useState } from 'react';
import { parseWordList } from '@/lib/domain/wordParse';
import { blobToBase64, downsizeImage } from './image';

type Words = { term: string; meaning: string }[];

const TESS_STATUS: Record<string, string> = {
  'loading tesseract core': '인식 엔진 불러오는 중',
  'initializing tesseract': '인식 엔진 준비 중',
  'loading language traineddata': '언어 데이터 받는 중 (처음 한 번은 오래 걸려요)',
  'initializing api': '인식 준비 중',
  'recognizing text': '글자 읽는 중',
};

class AiUnavailableError extends Error {}

async function recognizeWithAi(blob: Blob): Promise<Words> {
  const image = await blobToBase64(blob);
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, mediaType: 'image/jpeg' }),
  });
  if (res.status === 501) throw new AiUnavailableError();
  const json = (await res.json().catch(() => ({}))) as { words?: Words; error?: string };
  if (!res.ok || !json.words) throw new Error(json.error ?? '사진 인식에 실패했어요.');
  return json.words;
}

async function recognizeInBrowser(blob: Blob, onProgress: (text: string) => void): Promise<Words> {
  onProgress('인식 엔진 불러오는 중…');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['eng', 'kor'], undefined, {
    logger: (m) => {
      const label = TESS_STATUS[m.status] ?? '처리 중';
      onProgress(`${label}… ${Math.round(m.progress * 100)}%`);
    },
  });
  try {
    const { data } = await worker.recognize(blob);
    return parseWordList(data.text);
  } finally {
    await worker.terminate();
  }
}

export function PhotoPanel({ aiOcr, onParsed }: { aiOcr: boolean; onParsed: (words: Words) => string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setResult({ ok: false, text: '사진 파일만 올릴 수 있어요.' });
      return;
    }
    setBusy(true);
    setResult(null);
    setProgress('사진 줄이는 중…');
    try {
      const blob = await downsizeImage(file);
      setPreview(URL.createObjectURL(blob));

      let words: Words;
      if (aiOcr) {
        setProgress('AI가 사진 속 단어를 읽는 중… (10~30초)');
        try {
          words = await recognizeWithAi(blob);
        } catch (e) {
          if (!(e instanceof AiUnavailableError)) throw e;
          words = await recognizeInBrowser(blob, setProgress);
        }
      } else {
        words = await recognizeInBrowser(blob, setProgress);
      }

      if (words.length === 0) {
        setResult({ ok: false, text: '사진에서 단어를 찾지 못했어요. 밝은 곳에서 글자가 잘 보이게 다시 찍어 주세요.' });
      } else {
        setResult({ ok: true, text: onParsed(words) });
      }
    } catch (e) {
      console.error('[ocr]', e);
      setResult({ ok: false, text: e instanceof Error && e.message ? e.message : '사진 인식에 실패했어요.' });
    } finally {
      setBusy(false);
      setProgress(null);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        단어장 페이지를 반듯하게, 밝은 곳에서 찍어 주세요.{' '}
        <span className="text-slate-400">
          ({aiOcr ? 'AI 인식' : '기기에서 인식 · 손글씨는 잘 안 읽혀요'} · 사진은 저장되지 않아요)
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-primary h-14 text-base"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          📷 사진 찍기
        </button>
        <button
          type="button"
          className="btn-secondary h-14 text-base"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          🖼️ 앨범에서 고르기
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {(preview || busy) && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기
            <img src={preview} alt="올린 사진 미리보기" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
          )}
          <p className="text-sm text-slate-600" aria-live="polite">
            {busy ? (progress ?? '처리 중…') : '사진 인식이 끝났어요.'}
          </p>
        </div>
      )}

      {result && (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={`rounded-xl px-3 py-2 text-sm ${
            result.ok ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {result.text}
          {result.ok && <span className="mt-1 block font-semibold">⚠️ 사진 인식 결과는 꼭 확인하고 고쳐 주세요.</span>}
        </p>
      )}
    </div>
  );
}
