export type TestMode = 'spelling' | 'meaning' | 'mixed';
export type TestKind = 'regular' | 'retest';
export type TestStatus = 'in_progress' | 'submitted' | 'cancelled';

export const MODE_LABEL: Record<TestMode, string> = {
  spelling: '철자 쓰기',
  meaning: '뜻 쓰기',
  mixed: '섞어서',
};
