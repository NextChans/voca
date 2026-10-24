export type TestMode = 'spelling' | 'meaning' | 'mixed';
export type TestKind = 'regular' | 'retest' | 'book';
export type TestStatus = 'in_progress' | 'submitted' | 'cancelled';

export const MODE_LABEL: Record<TestMode, string> = {
  spelling: '철자 쓰기',
  meaning: '뜻 쓰기',
  mixed: '섞어서',
};

export const KIND_LABEL: Record<TestKind, string> = {
  regular: '정기 시험',
  retest: '재시험',
  book: '단어책 시험',
};

export const KIND_ICON: Record<TestKind, string> = {
  regular: '✏️',
  retest: '🔁',
  book: '📗',
};

/** 목록 꼬리표용 짧은 이름과 색 */
export const KIND_BADGE: Record<TestKind, { text: string; tone: string }> = {
  regular: { text: '정기', tone: 'bg-brand-100 text-brand-700' },
  retest: { text: '재시험', tone: 'bg-violet-100 text-violet-700' },
  book: { text: '단어책', tone: 'bg-teal-100 text-teal-700' },
};

/** 시험 이름 (단어책 시험·그 재시험은 책 이름을 붙인다) */
export function testTitle(t: { kind: TestKind; book_name: string | null }): string {
  return t.book_name ? `${KIND_LABEL[t.kind]} · ${t.book_name}` : KIND_LABEL[t.kind];
}
