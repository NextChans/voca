export interface EditRow {
  key: string;
  term: string;
  meaning: string;
}

export const MAX_ROWS = 300;
const TERM = /^[a-z][a-z\s'’\-./]*$/i;

let seq = 0;
export function newRow(term = '', meaning = ''): EditRow {
  seq += 1;
  return { key: `r${Date.now().toString(36)}${seq}`, term, meaning };
}

export function isBlank(r: EditRow): boolean {
  return !r.term.trim() && !r.meaning.trim();
}

export type RowIssue = { field: 'term' | 'meaning'; message: string } | null;

export function rowIssue(r: EditRow): RowIssue {
  if (isBlank(r)) return null;
  const term = r.term.trim();
  const meaning = r.meaning.trim();
  if (!term) return { field: 'term', message: '영어 단어를 입력해 주세요.' };
  if (term.length > 100) return { field: 'term', message: '단어가 너무 길어요.' };
  if (!TERM.test(term)) return { field: 'term', message: '알파벳으로 시작하고 알파벳만 써 주세요.' };
  if (!meaning) return { field: 'meaning', message: '뜻을 입력해 주세요.' };
  if (meaning.length > 200) return { field: 'meaning', message: '뜻은 200자까지예요.' };
  return null;
}

/** 표 안에서 앞에 같은 철자(대소문자 무시)가 이미 있는 행의 key 집합 */
export function duplicateKeys(rows: EditRow[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const r of rows) {
    const k = r.term.trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) dup.add(r.key);
    else seen.add(k);
  }
  return dup;
}

/** 빈 행을 정리하고 새 단어들을 덧붙인다 (최대 MAX_ROWS) */
export function appendRows(
  rows: EditRow[],
  words: { term: string; meaning: string }[]
): { rows: EditRow[]; added: number; dropped: number } {
  const kept = rows.filter((r) => !isBlank(r));
  const room = Math.max(0, MAX_ROWS - kept.length);
  const add = words.slice(0, room).map((w) => newRow(w.term, w.meaning));
  return { rows: [...kept, ...add], added: add.length, dropped: words.length - add.length };
}
