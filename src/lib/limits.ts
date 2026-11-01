// 공개 서비스 남용·비용 방어 한도. 데이터 상한(자녀·단어·단어책)의 원천은 DB 트리거
// (supabase/migrations/20261020000000_quotas_and_caps.sql, 단어책은 20261021000000_word_books.sql)이고, 여기 값은 안내 문구·사전 차단용으로 같게 유지한다.

/** 가족당 하루 AI 사진 인식 횟수 (KST 자정 초기화) */
export const OCR_DAILY_PER_FAMILY = 10;
/** 가족당 하루 서버 발음 합성 횟수. 기기 음성·브라우저 캐시 재생은 세지 않음 */
export const TTS_DAILY_PER_FAMILY = 500;
/** 가족당 자녀 프로필 수 (DB: enforce_learner_cap) */
export const MAX_LEARNERS_PER_FAMILY = 4;
/** 자녀당 단어 수 (DB: enforce_word_cap) */
export const MAX_WORDS_PER_LEARNER = 5000;
/** 자녀당 단어책 수 (DB: enforce_book_cap) */
export const MAX_BOOKS_PER_LEARNER = 30;
