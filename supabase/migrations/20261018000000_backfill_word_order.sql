-- =====================================================================
-- 기존 단어의 등록 순서 복원 (데이터 보정, 1회성 · 재실행 안전)
--
-- 문제: 한 번에 저장한 단어들이 같은 created_at 을 가져 목록이 철자순으로 보였다.
--       (앱은 #9 부터 1ms 간격으로 저장하지만, 그 전 데이터는 그대로)
-- 방법: 같은 (learner_id, created_at) 묶음 안에서 물리적 저장 위치(ctid) 순서 = 삽입 순서로 보고
--       두 번째 행부터 1ms 씩 더한다. 한 INSERT 문으로 들어간 행은 ctid 가 입력 순서대로 이어진다.
-- 한계: 저장 후 수정(UPDATE)된 단어는 ctid 가 바뀌어 묶음의 맨 뒤로 갈 수 있다.
-- 영향: 등록 시각이 최대 수백 ms 늘어날 뿐, 등록 날짜(KST)·출제 규칙에는 사실상 영향 없음.
-- =====================================================================

with ranked as (
  select id,
         created_at,
         row_number() over (partition by learner_id, created_at order by ctid) - 1 as rn,
         count(*)     over (partition by learner_id, created_at)                as cnt
    from public.words
)
update public.words w
   set created_at = r.created_at + r.rn * interval '1 millisecond'
  from ranked r
 where w.id = r.id
   and r.cnt > 1
   and r.rn > 0;
