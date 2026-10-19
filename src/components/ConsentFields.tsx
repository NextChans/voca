'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CONSENT_KINDS, CONSENT_LABELS, type ConsentKind } from '@/lib/legal';

/** 가입(가족 생성·합류)·재동의 폼에 넣는 필수 동의 체크박스. 서버 액션이 name="consent" 값으로 검증·기록한다. */
export function ConsentFields() {
  const [checked, setChecked] = useState<Record<ConsentKind, boolean>>(
    () => Object.fromEntries(CONSENT_KINDS.map((k) => [k, false])) as Record<ConsentKind, boolean>
  );
  const all = CONSENT_KINDS.every((k) => checked[k]);
  const setAll = (v: boolean) =>
    setChecked(Object.fromEntries(CONSENT_KINDS.map((k) => [k, v])) as Record<ConsentKind, boolean>);

  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
      <legend className="px-1 font-semibold text-slate-700">약관 동의</legend>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" className="h-5 w-5" checked={all} onChange={(e) => setAll(e.target.checked)} />
        모두 동의해요
      </label>
      <div className="space-y-1.5 border-t border-slate-100 pt-2">
        {CONSENT_KINDS.map((k) => (
          <label key={k} className="flex items-start gap-2 text-slate-600">
            <input
              type="checkbox"
              name="consent"
              value={k}
              required
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={checked[k]}
              onChange={(e) => setChecked((c) => ({ ...c, [k]: e.target.checked }))}
            />
            <span>{CONSENT_LABELS[k]}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        자세한 내용은{' '}
        <Link href="/terms" target="_blank" className="underline">
          이용약관
        </Link>
        과{' '}
        <Link href="/privacy" target="_blank" className="underline">
          개인정보 처리방침
        </Link>
        에서 볼 수 있어요. 아이 정보는 부모님(법정대리인)만 등록할 수 있어요.
      </p>
    </fieldset>
  );
}
