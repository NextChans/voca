/**
 * 영어 단어(term) 입력 규칙 — 등록 폼·수정·사진 인식·텍스트 붙여넣기·서버 액션·발음 API 공통.
 *
 * - 라틴 문자(악센트 포함: café)가 최소 1개
 * - 그 외에는 라틴 문자·공백·문장부호·기호만 (o'clock, T-shirt, Mr., rock & roll, (be) good at ~)
 * - 숫자·한글 등 다른 문자 체계·제어 문자는 불가
 *   (사진·붙여넣기에서 "Chapter 1 제1장" 같은 머리글이나 뜻이 단어로 섞여 들어오는 것을 막기 위해)
 */
export const TERM_PATTERN = /^(?=.*\p{Script=Latin})[\p{Script=Latin}\p{P}\p{S}\p{Zs}]+$/u;

export const TERM_MAX = 100;

export function isValidTerm(term: string): boolean {
  return term.length > 0 && term.length <= TERM_MAX && TERM_PATTERN.test(term);
}

export const TERM_ERROR = "영어 단어는 알파벳과 기호(' - . & ~ 등)로 써 주세요. 숫자와 한글은 쓸 수 없어요.";
