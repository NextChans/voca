/**
 * 여러 줄 텍스트(직접 붙여넣기 / OCR 결과) → [{ term, meaning }]
 *
 * 지원 형식 (한 줄에 한 단어):
 *   apple 사과            (영문 뒤 한글)
 *   apple - 사과 / apple : 사과 / apple = 사과 / apple<TAB>사과
 *   1. apple 사과, 능금    (앞 번호 제거)
 *   사과 apple            (한글 뒤 영문도 허용)
 */
export interface ParsedWord {
  term: string;
  meaning: string;
}

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const LEADING_NUMBER = /^\s*(?:\(?\d{1,3}[.)\]]|[①-⑳]|[-*•·▪◦])\s*/u;

function clean(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:=|.,]+|[\s\-:=|,]+$/g, '')
    .trim();
}

export function parseWordLine(rawLine: string): ParsedWord | null {
  const line = rawLine.normalize('NFKC').replace(LEADING_NUMBER, '').trim();
  if (!line) return null;

  // 명시적 구분자 우선
  const explicit = line.split(/\t| [-–—:=|] |\s*[:=|]\s*/);
  if (explicit.length >= 2) {
    const [a, ...rest] = explicit;
    const left = clean(a ?? '');
    const right = clean(rest.join(' '));
    if (left && right) {
      return HANGUL.test(left) && !HANGUL.test(right)
        ? { term: right, meaning: left }
        : { term: left, meaning: right };
    }
  }

  // 영문 → 한글 전환 지점 기준 분리
  const idx = line.search(HANGUL);
  if (idx > 0) {
    const term = clean(line.slice(0, idx));
    const meaning = clean(line.slice(idx));
    if (/[a-z]/i.test(term) && meaning) return { term, meaning };
  }
  // 한글 → 영문
  if (idx === 0) {
    const m = line.match(/^(.*?[ㄱ-ㆎ가-힣)\]][^a-z]*?)\s+([a-z][a-z\s'’\-.]*)$/i);
    if (m) {
      const meaning = clean(m[1] ?? '');
      const term = clean(m[2] ?? '');
      if (term && meaning) return { term, meaning };
    }
  }
  return null;
}

export function parseWordList(text: string): ParsedWord[] {
  const out: ParsedWord[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const w = parseWordLine(line);
    if (!w || !/^[a-z][a-z\s'’\-./]*$/i.test(w.term)) continue;
    const key = w.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}
