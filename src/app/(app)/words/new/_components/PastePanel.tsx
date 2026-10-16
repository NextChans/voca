'use client';

import { useState } from 'react';
import { parseWordList } from '@/lib/domain/wordParse';

const EXAMPLE = `apple 사과
banana - 바나나
1. cherry 체리, 버찌`;

export function PastePanel({ onParsed }: { onParsed: (words: { term: string; meaning: string }[]) => string }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const convert = () => {
    const words = parseWordList(text);
    const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
    if (words.length === 0) {
      setNote('단어를 찾지 못했어요. 한 줄에 "영어 단어 + 뜻" 형식인지 확인해 주세요.');
      return;
    }
    const result = onParsed(words);
    const missed = lines - words.length;
    setNote(`${result}${missed > 0 ? ` 읽지 못했거나 겹친 줄 ${missed}개는 빠졌어요.` : ''}`);
    setText('');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        한 줄에 단어 하나씩 붙여넣어 주세요. <span className="text-slate-400">(단어와 뜻 사이는 띄어쓰기, -, :, 탭 모두 괜찮아요)</span>
      </p>
      <textarea
        className="input min-h-48 font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="단어 목록 붙여넣기"
      />
      <button type="button" className="btn-primary w-full" onClick={convert} disabled={!text.trim()}>
        표로 옮기기 ⬇️
      </button>
      {note && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">{note}</p>}
    </div>
  );
}
