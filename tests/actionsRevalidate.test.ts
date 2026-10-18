import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * next.config 의 staleTimes 로 클라이언트가 화면을 잠시 캐시하므로, 상태를 바꾸는 서버 액션은
 * 반드시 revalidatePath('/', 'layout') 로 캐시를 비워야 한다. (빠뜨리면 redirect 후 이전 화면이 재사용됨:
 * 예) 가족 생성 직후 /profiles 가 '가족 없음 → 온보딩' 캐시로 되돌아감)
 */
const NO_VISIBLE_STATE = new Set([
  'createInviteAction', // 코드는 응답으로만 보여줌
  'resetLearnerPasswordAction', // 화면에 드러나는 상태 없음
]);

describe('server actions', () => {
  const src = readFileSync(new URL('../src/app/actions.ts', import.meta.url), 'utf8');
  const actions = [...src.matchAll(/^export async function (\w+Action)\(/gm)].map((m) => {
    const start = m.index!;
    const next = src.indexOf('\nexport async function ', start + 1);
    return { name: m[1]!, body: src.slice(start, next === -1 ? undefined : next) };
  });

  it('액션 목록을 찾는다', () => {
    expect(actions.length).toBeGreaterThan(15);
  });

  it.each(actions.filter((a) => !NO_VISIBLE_STATE.has(a.name)).map((a) => [a.name, a.body]))(
    '%s 는 revalidatePath("/", "layout") 를 호출한다',
    (_name, body) => {
      expect(body).toContain("revalidatePath('/', 'layout')");
    }
  );
});
