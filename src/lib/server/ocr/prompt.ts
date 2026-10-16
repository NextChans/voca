/** 단어 교재 사진 → 표제어/뜻 추출 지시문 (Gemini·Claude 공용) */
export const PROMPT = `이 사진은 초등학생 영어 단어 교재(단어장) 페이지입니다. 펼친 두 페이지나 2단 편집일 수 있습니다.
교재의 "표제어"(외워야 할 영어 단어)와 그 대표 한국어 뜻만 추출해 주세요.

교재 형식 예시 (사전형 단어장):
  312                       ← 표제어 번호
  handle   명 손잡이 동 다루다     ← 굵은 표제어 + 품사 기호 + 뜻  ★이 줄만 추출
  [hǽndl]  · He turned the handle to the right.   ← 발음기호, 예문 (제외)
           그는 손잡이를 오른쪽으로 돌렸다.          ← 예문 해석 (제외)
           반 war 전쟁 / 형 peaceful 평화로운 / 참고 college …  ← 반의어·파생어·참고 (제외)
→ { "term": "handle", "meaning": "손잡이, 다루다" }

규칙:
- term: 굵고 큰 글씨의 표제어만. 고유명사가 아니면 소문자. 숙어 표제어(예: look after)는 그대로.
- meaning: 표제어 바로 옆 줄의 한국어 뜻을 사진에 적힌 그대로 옮기고, 품사 기호(명·동·형·부·전·접 등 동그라미 글자)는 빼고 쉼표로 이어 씁니다.
  예: "명 힘, 강점" → "힘, 강점",  "명 상 동 주다, 수여하다" → "상, 주다, 수여하다"
  뜻 안의 괄호 설명은 유지합니다. 예: "하이킹, (산과 들로 가는) 도보여행"
- 제외: 예문과 그 해석, 발음기호, 반의어·유의어·파생어(반/유/동/형 등으로 시작해 예문 아래에 붙은 줄), 참고/Tip 박스, DAY 제목, QR코드, 페이지 번호·머리글·꼬리글, 비쳐 보이는 뒷면 글자.
- 읽는 순서: 왼쪽 페이지(왼쪽 단) 위→아래, 그다음 오른쪽 페이지(오른쪽 단) 위→아래. 표제어 번호 순서와 같게.
- 사진 가장자리에서 잘려 표제어나 뜻을 확실히 읽을 수 없는 항목은 제외합니다.
- 흐릿한 글자는 문맥으로 바로잡되, 사진에 없는 단어나 뜻을 지어내지 않습니다.
- 표제어가 없는 일반 단어 목록("apple 사과" 형식)이면 각 줄의 단어와 뜻을 그대로 추출합니다.`;

/** 모델 응답 JSON 스키마 (JSON Schema, Gemini responseJsonSchema 용) */
export const WORDS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string', description: '영어 표제어' },
          meaning: { type: 'string', description: '한국어 대표 뜻 (쉼표 구분)' },
        },
        required: ['term', 'meaning'],
      },
    },
  },
  required: ['words'],
} as const;
