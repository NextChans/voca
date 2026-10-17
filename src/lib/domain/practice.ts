import { kstDate } from './week';

/**
 * 오답 연습 대상 집계 (순수 함수)
 * 입력: 제출된 시험의 문항 결과들 (부모 정정 반영된 is_correct)
 * 출력: 한 번이라도 틀린 단어 목록. 같은 단어는 철자(소문자) 기준으로 묶는다.
 */
export interface PracticeResultRow {
  word_id: string | null;
  term: string;
  meaning: string;
  is_correct: boolean | null;
  submitted_at: string;
}

export interface PracticeWord {
  key: string;
  term: string;
  meaning: string;
  wrongCount: number;
  attempts: number;
  /** 가장 최근 시험에서 틀렸는지 (아직 약한 단어) */
  lastWrong: boolean;
  lastWrongAt: string | null;
}

export function buildPracticeWords(rows: readonly PracticeResultRow[]): PracticeWord[] {
  const byKey = new Map<string, PracticeWord & { lastAt: string }>();
  // 시간순으로 훑어 마지막 결과·최신 철자/뜻을 반영
  const sorted = [...rows].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  for (const r of sorted) {
    if (r.is_correct === null) continue;
    const key = r.term.trim().toLowerCase();
    if (!key) continue;
    const cur = byKey.get(key) ?? {
      key,
      term: r.term.trim(),
      meaning: r.meaning.trim(),
      wrongCount: 0,
      attempts: 0,
      lastWrong: false,
      lastWrongAt: null,
      lastAt: '',
    };
    cur.attempts++;
    cur.term = r.term.trim();
    cur.meaning = r.meaning.trim();
    cur.lastWrong = !r.is_correct;
    cur.lastAt = r.submitted_at;
    if (!r.is_correct) {
      cur.wrongCount++;
      cur.lastWrongAt = r.submitted_at;
    }
    byKey.set(key, cur);
  }
  return [...byKey.values()]
    .filter((w) => w.wrongCount > 0)
    .map((w): PracticeWord => ({
      key: w.key,
      term: w.term,
      meaning: w.meaning,
      wrongCount: w.wrongCount,
      attempts: w.attempts,
      lastWrong: w.lastWrong,
      lastWrongAt: w.lastWrongAt,
    }))
    .sort(
      (a, b) =>
        Number(b.lastWrong) - Number(a.lastWrong) ||
        b.wrongCount - a.wrongCount ||
        (b.lastWrongAt ?? '').localeCompare(a.lastWrongAt ?? '')
    );
}

/** 새 단어 연습 대상 (아직 정기 시험에 안 나온 단어) */
export interface NewWordInput {
  id: string;
  term: string;
  meaning: string;
  created_at: string;
}

export interface NewPracticeWord {
  key: string;
  term: string;
  meaning: string;
  /** KST 기준 오늘 등록했는지 */
  registeredToday: boolean;
  /** KST 등록일 YYYY-MM-DD */
  registeredDate: string;
}

/**
 * 정기 시험(취소 제외, 진행 중 포함)에 한 번도 안 나온 단어를 등록 순서대로 돌려준다.
 * 진행 중 시험 문항을 빼야 연습으로 정답이 새지 않는다.
 */
export function buildNewWords(
  words: readonly NewWordInput[],
  testedIds: ReadonlySet<string>,
  now: Date
): NewPracticeWord[] {
  const today = kstDate(now);
  return words
    .filter((w) => !testedIds.has(w.id))
    .map((w) => {
      const registeredDate = kstDate(w.created_at);
      return {
        key: w.id,
        term: w.term,
        meaning: w.meaning,
        registeredToday: registeredDate === today,
        registeredDate,
      };
    });
}
