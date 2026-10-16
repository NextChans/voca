/**
 * 모바일 키보드 힌트.
 * 웹은 키보드 "언어"를 직접 바꿀 수 없다. 대신 inputMode="email" 을 주면
 * iOS 는 영문(ASCII) 전용 키보드를 띄우고, 다른 칸으로 옮기면 직전 언어(한글)로 돌아간다.
 * 안드로이드는 키보드 앱에 따라 영문 자판으로 바뀌거나 그대로일 수 있다.
 */
export const englishInputProps = {
  inputMode: 'email',
  lang: 'en',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
} as const;

export const koreanInputProps = {
  inputMode: 'text',
  lang: 'ko',
} as const;
