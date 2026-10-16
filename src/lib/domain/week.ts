/** 시험 주간은 한국 시간(KST, UTC+9, 서머타임 없음) 월요일 00:00 시작. DB의 kst_week_start()와 동일 규칙. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** KST 기준 해당 주 월요일 (YYYY-MM-DD) */
export function kstWeekStart(at: Date = new Date()): string {
  const kst = at.getTime() + KST_OFFSET_MS;
  const dayStart = Math.floor(kst / DAY_MS) * DAY_MS;
  const weekday = (new Date(dayStart).getUTCDay() + 6) % 7; // 월=0 … 일=6
  return toIsoDate(dayStart - weekday * DAY_MS);
}

/** 주간 범위 표시용: "10/13(월) ~ 10/19(일)" */
export function weekRangeLabel(weekStart: string): string {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const end = start + 6 * DAY_MS;
  const fmt = (ms: number, dow: string) => {
    const d = new Date(ms);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dow})`;
  };
  return `${fmt(start, '월')} ~ ${fmt(end, '일')}`;
}

/** 날짜·시각 표시 (KST) */
export function formatKst(iso: string, withTime = true): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(iso));
}

/** ISO 시각 → KST 날짜 (YYYY-MM-DD) */
export function kstDate(at: Date | string): string {
  const ms = typeof at === 'string' ? Date.parse(at) : at.getTime();
  return toIsoDate(ms + KST_OFFSET_MS);
}

/** 등록일(KST) 다음 날 00:00 부터 시험 출제 가능. DB create_test 와 동일 규칙. */
export function isTestableWord(createdAt: string, now: Date = new Date()): boolean {
  return kstDate(createdAt) < kstDate(now);
}
