'use client';

import { useState } from 'react';
import { speakItem, speakText } from '@/lib/client/speech';

type Props = ({ text: string; itemId?: never } | { itemId: string; text?: never }) & {
  size?: 'sm' | 'lg';
  label?: string;
};

/** 🔊 발음 듣기 버튼. 시험 철자 문항은 itemId 로(정답 비노출), 그 외에는 text 로. */
export function SpeakButton({ text, itemId, size = 'sm', label }: Props) {
  const [error, setError] = useState(false);
  const onClick = async () => {
    setError(false);
    try {
      if (itemId) await speakItem(itemId);
      else if (text) await speakText(text);
    } catch {
      setError(true);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? '발음 듣기'}
      title={error ? '발음을 불러오지 못했어요' : '발음 듣기'}
      className={
        size === 'lg'
          ? 'btn-secondary h-14 px-5 text-lg'
          : 'inline-flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-slate-100'
      }
    >
      {error ? '⚠️' : '🔊'}
      {size === 'lg' && <span>{label ?? '발음 듣기'}</span>}
    </button>
  );
}
