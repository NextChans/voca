/** 결과 화면 공용: 점수 → 퍼센트·색·응원 문구 */

export function percent(correct: number | null, total: number): number {
  if (!total || correct === null) return 0;
  return Math.round((correct / total) * 100);
}

export function scoreTextClass(pct: number): string {
  if (pct >= 90) return 'text-emerald-600';
  if (pct >= 70) return 'text-brand-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

export function scoreBarClass(pct: number): string {
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-brand-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-rose-400';
}

export function scoreFeedback(pct: number): { emoji: string; text: string } {
  if (pct === 100) return { emoji: '🏆', text: '만점! 정말 완벽해요!' };
  if (pct >= 90) return { emoji: '🎉', text: '거의 다 맞았어요. 대단해요!' };
  if (pct >= 70) return { emoji: '😄', text: '잘했어요! 조금만 더 하면 만점이에요.' };
  if (pct >= 50) return { emoji: '💪', text: '절반 넘게 맞았어요. 재시험으로 한 번 더 해 봐요!' };
  return { emoji: '🌱', text: '괜찮아요! 틀린 단어를 다시 보면 금방 늘어요.' };
}
