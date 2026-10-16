/**
 * 자동 채점 규칙 (순수 함수 — 서버에서만 호출되지만 의존성이 없어 단위 테스트 대상)
 *
 * 스펠링(direction = 'spelling')
 *  - 대소문자·앞뒤 공백·연속 공백·둥근 따옴표(’) 차이는 무시
 *  - 등록된 단어에 "/" 로 변형 표기가 있으면 (예: "color / colour") 어느 쪽이든 정답
 *
 * 뜻(direction = 'meaning')
 *  - 등록된 뜻을 , ; / · 줄바꿈 으로 나눈 각 항목이 정답 후보
 *  - 괄호 안 보충 설명((과일), [동사])·번호(1. ①)·물결(~)·공백·문장부호는 비교에서 제외
 *  - 아이가 여러 뜻을 쓴 경우 "쓴 항목이 모두 정답 후보 중 하나"여야 정답
 *    (여러 개를 마구 적어서 하나 맞히는 꼼수 방지)
 *  - 그 외 애매한 경우(유의어·활용형)는 결과 화면에서 부모가 "정답 인정"으로 보정
 */

export type Direction = 'spelling' | 'meaning';

export function normalizeSpelling(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[‐-―]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim();
}

export function spellingVariants(term: string): string[] {
  return term
    .split('/')
    .map(normalizeSpelling)
    .filter((v) => v.length > 0);
}

export function gradeSpelling(term: string, answer: string): boolean {
  const a = normalizeSpelling(answer);
  if (!a) return false;
  return spellingVariants(term).includes(a);
}

const MEANING_SEPARATORS = /[,，、;；/·\n]/;

function stripBrackets(s: string): string {
  return s.replace(/\([^)]*\)|\[[^\]]*\]|（[^）]*）|<[^>]*>/g, ' ');
}

export function normalizeMeaning(input: string): string {
  return input
    .replace(/^\s*[①-⑳]\s*/u, '') // NFKC 가 ①→1 로 바꾸기 전에 제거
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^\s*\d+[.)]\s*/u, '')
    .replace(/[~∼〜]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** 등록된 뜻 → 정답 후보 목록 */
export function meaningVariants(meaning: string): string[] {
  const variants = new Set<string>();
  for (const part of meaning.split(MEANING_SEPARATORS)) {
    const stripped = normalizeMeaning(stripBrackets(part));
    // 괄호만으로 이루어진 항목이면 괄호 내용 자체를 후보로
    const value = stripped || normalizeMeaning(part);
    if (value) variants.add(value);
  }
  return [...variants];
}

export function gradeMeaning(meaning: string, answer: string): boolean {
  const candidates = meaningVariants(meaning);
  const parts = answer
    .split(MEANING_SEPARATORS)
    .map((p) => normalizeMeaning(stripBrackets(p)) || normalizeMeaning(p))
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  return parts.every((p) => candidates.includes(p));
}

export function gradeItem(
  item: { direction: Direction; term: string; meaning: string },
  answer: string
): boolean {
  return item.direction === 'spelling'
    ? gradeSpelling(item.term, answer)
    : gradeMeaning(item.meaning, answer);
}
