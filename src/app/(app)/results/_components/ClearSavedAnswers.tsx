'use client';

import { useEffect } from 'react';

/** 제출이 끝난 시험의 임시 답안(localStorage)을 지운다 */
export function ClearSavedAnswers({ testId }: { testId: string }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem(`voca:test:${testId}`);
    } catch {
      // 무시
    }
  }, [testId]);
  return null;
}
