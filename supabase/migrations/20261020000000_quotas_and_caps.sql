-- 일반 공개 준비 (PR 2): 비용·남용 방어
-- 1) 가족별 일일 사용 한도 (사진 인식, 서버 발음 합성)
-- 2) 데이터 상한: 가족당 자녀 4명, 자녀당 단어 5,000개
-- 재실행 안전(if not exists / create or replace / drop trigger if exists). 한 트랜잭션으로 실행(전부 적용 또는 전부 취소).

begin;

-- ---------------------------------------------------------------- 일일 사용량
create table if not exists public.usage_counters (
  family_id  uuid not null references public.families (id) on delete cascade,
  kind       text not null check (kind in ('ocr', 'tts')),
  day        date not null,                 -- KST 날짜
  count      int  not null default 0 check (count >= 0),
  primary key (family_id, kind, day)
);

alter table public.usage_counters enable row level security;
revoke all on public.usage_counters from anon, authenticated;

-- 한도 안이면 1 증가시키고 오늘 사용량을 돌려준다. 한도에 닿았으면 증가 없이 QUOTA_EXCEEDED.
-- 단일 UPSERT 문이라 동시 요청에도 한도를 넘지 않는다.
create or replace function public.consume_quota(p_family_id uuid, p_kind text, p_limit int)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'Asia/Seoul')::date;
  v_count int;
begin
  insert into public.usage_counters as u (family_id, kind, day, count)
  values (p_family_id, p_kind, v_day, 1)
  on conflict (family_id, kind, day)
    do update set count = u.count + 1
    where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    raise exception 'QUOTA_EXCEEDED';
  end if;
  return v_count;
end;
$$;

-- 외부 API 실패 등으로 사용하지 못한 1회를 되돌린다.
create or replace function public.refund_quota(p_family_id uuid, p_kind text)
returns void
language sql
set search_path = public
as $$
  update public.usage_counters
     set count = count - 1
   where family_id = p_family_id and kind = p_kind
     and day = (now() at time zone 'Asia/Seoul')::date and count > 0;
$$;

-- ---------------------------------------------------------------- 데이터 상한
-- 문 단위 AFTER 트리거 + 전이 테이블: 여러 행을 한 번에 넣어도 최종 개수로 판단하고, 넘으면 문 전체가 롤백된다.
create or replace function public.enforce_learner_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
      from (select distinct family_id from new_rows) n
     where (select count(*) from public.learners l where l.family_id = n.family_id) > 4
  ) then
    raise exception 'LEARNER_LIMIT';
  end if;
  return null;
end;
$$;

drop trigger if exists learners_cap on public.learners;
create trigger learners_cap
  after insert on public.learners
  referencing new table as new_rows
  for each statement execute function public.enforce_learner_cap();

create or replace function public.enforce_word_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
      from (select distinct learner_id from new_rows) n
     where (select count(*) from public.words w where w.learner_id = n.learner_id) > 5000
  ) then
    raise exception 'WORD_LIMIT';
  end if;
  return null;
end;
$$;

drop trigger if exists words_cap on public.words;
create trigger words_cap
  after insert on public.words
  referencing new table as new_rows
  for each statement execute function public.enforce_word_cap();

-- ---------------------------------------------------------------- 부모 PIN 시도 제한 강화
-- 기존: 확인 후 기록 → 병렬 요청이 잠금 전에 대량 시도 가능, 잠금 5분 고정.
-- 변경: 확인 "전에" 행 잠금으로 시도 1회를 먼저 차감(병렬 직렬화), 잠금은 5분·10분·20분… 지수 증가(최대 약 21시간).
alter table public.families add column if not exists pin_lock_count int not null default 0;

create or replace function public.reserve_pin_attempt(p_family_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_failed int;
  v_locked timestamptz;
  v_locks  int;
begin
  select pin_failed_count, pin_locked_until, pin_lock_count into v_failed, v_locked, v_locks
    from public.families where id = p_family_id for update;
  if not found then raise exception 'FAMILY_NOT_FOUND'; end if;
  if v_locked is not null and v_locked > now() then raise exception 'PIN_LOCKED'; end if;

  if v_failed + 1 >= 5 then
    update public.families
       set pin_failed_count = 0,
           pin_locked_until = now() + make_interval(mins => 5 * (2 ^ least(v_locks, 8))::int),
           pin_lock_count = v_locks + 1
     where id = p_family_id;
  else
    update public.families set pin_failed_count = v_failed + 1 where id = p_family_id;
  end if;
end;
$$;

-- 성공 시 실패 횟수·잠금·잠금 단계 모두 초기화 (실패 기록은 reserve_pin_attempt 가 담당)
create or replace function public.record_pin_attempt(p_family_id uuid, p_success boolean)
returns timestamptz
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_success then
    update public.families
       set pin_failed_count = 0, pin_locked_until = null, pin_lock_count = 0
     where id = p_family_id;
  end if;
  return null;
end;
$$;

revoke all on function public.reserve_pin_attempt(uuid) from public, anon, authenticated;
grant execute on function public.reserve_pin_attempt(uuid) to service_role;
revoke all on function public.record_pin_attempt(uuid, boolean) from public, anon, authenticated;
grant execute on function public.record_pin_attempt(uuid, boolean) to service_role;

-- PR #16 함수: service_role 만 호출하므로 SECURITY DEFINER 불필요 → INVOKER 로 (권한 누락 시 피해 축소)
alter function public.record_consent(uuid, text, text[]) security invoker;
alter function public.delete_parent_account(uuid) security invoker;

revoke all on function public.consume_quota(uuid, text, int) from public, anon, authenticated;
grant execute on function public.consume_quota(uuid, text, int) to service_role;
revoke all on function public.refund_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_quota(uuid, text) to service_role;
revoke all on function public.enforce_learner_cap() from public, anon, authenticated;
revoke all on function public.enforce_word_cap() from public, anon, authenticated;

commit;
