-- =====================================================================
-- Voca: 영어 단어 성취도 평가 (가족 단위)
--
-- 도메인:
--   family        가족(테넌트). 부모 PIN 보관.
--   family_members 가족에 속한 부모 로그인 계정 (Supabase Auth 사용자). 부모 2명 모두 관리 가능.
--   learners      자녀 학습자 프로필 (로그인 계정 아님). 단어·시험·주간 횟수는 자녀별.
--
-- 출제 규칙 (create_test 에서 강제):
--   * 정기 시험: 주(KST 월요일 시작)당 learners.weekly_limit 회 (기본 2회)
--   * 출제 대상: 등록일(KST) 다음 날부터 + 아직 정기 시험에 나온 적 없는 단어 전부 (최대 300, 오래된 순)
--   * 출제 대상이 learners.min_test_words 개(기본 50) 미만이면 시험 불가
--   * 재시험: 제출된 시험의 틀린 문항만. 주간 횟수에 포함되지 않음
--
-- 보안 모델 (BFF):
--   * 브라우저는 Supabase Auth(로그인)만 직접 사용한다.
--   * 모든 테이블은 RLS 활성화 + 정책 없음 → anon/authenticated 롤은 행을 전혀 읽고 쓸 수 없다.
--   * 데이터 접근은 Next.js 서버(service_role)에서만, 검증된 사용자의 family_id 로 범위를 한정한다.
--   * 채점 정답(test_items.term/meaning)이 시험 중 브라우저로 노출되지 않게 하기 위함.
--
-- 정합성:
--   * 주간 응시 횟수 제한, 자녀별 동시 진행 시험 1건, 제출·채점 확정, 초대코드 사용은
--     모두 아래 함수에서 단일 트랜잭션 + advisory lock / 행 잠금으로 처리한다.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 가족 / 부모 / 자녀
-- ---------------------------------------------------------------------
create table public.families (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 1 and 30),
  parent_pin_hash   text,
  pin_failed_count  smallint    not null default 0,
  pin_locked_until  timestamptz,
  created_at        timestamptz not null default now()
);

create table public.family_members (
  family_id     uuid not null references public.families (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 20),
  joined_at     timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)   -- 한 계정은 한 가족에만
);

create table public.family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  code_hash   text not null unique,        -- sha256(code). 원문은 저장하지 않는다
  created_by  uuid not null references auth.users (id) on delete cascade,
  expires_at  timestamptz not null,
  used_by     uuid references auth.users (id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index family_invites_family_idx on public.family_invites (family_id);

create table public.learners (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 20),
  avatar        text not null default '🐣' check (char_length(avatar) between 1 and 8),
  weekly_limit    smallint not null default 2  check (weekly_limit between 1 and 14),
  min_test_words  smallint not null default 50 check (min_test_words between 1 and 200),
  created_at      timestamptz not null default now(),
  unique (family_id, name)
);

-- ---------------------------------------------------------------------
-- 단어 (자녀별)
-- ---------------------------------------------------------------------
create table public.words (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  learner_id  uuid not null references public.learners (id) on delete cascade,
  term        text not null check (char_length(btrim(term)) between 1 and 100),
  meaning     text not null check (char_length(btrim(meaning)) between 1 and 200),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index words_learner_term_uniq on public.words (learner_id, lower(btrim(term)));
create index words_learner_created_idx on public.words (learner_id, created_at);

-- ---------------------------------------------------------------------
-- 시험 / 문항 (자녀별)
-- ---------------------------------------------------------------------
create table public.tests (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  learner_id      uuid not null references public.learners (id) on delete cascade,
  kind            text not null check (kind in ('regular', 'retest')),
  mode            text not null check (mode in ('spelling', 'meaning', 'mixed')),
  parent_test_id  uuid references public.tests (id) on delete set null,
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'submitted', 'cancelled')),
  -- KST 기준 해당 주 월요일. 주간 응시 횟수 계산 기준.
  week_start      date not null,
  total           smallint not null check (total > 0),
  correct         smallint check (correct between 0 and total),
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  cancelled_by    uuid references auth.users (id) on delete set null,
  constraint tests_submitted_consistency check (
    (status = 'submitted') = (submitted_at is not null and correct is not null)
  )
);
create index tests_learner_started_idx on public.tests (learner_id, started_at desc);
create index tests_learner_week_idx on public.tests (learner_id, week_start) where kind = 'regular';
create index tests_parent_idx on public.tests (parent_test_id);
-- 자녀별로 동시에 진행 중인 시험은 1건
create unique index tests_one_in_progress_uniq on public.tests (learner_id) where status = 'in_progress';

create table public.test_items (
  id             uuid primary key default gen_random_uuid(),
  test_id        uuid not null references public.tests (id) on delete cascade,
  family_id      uuid not null references public.families (id) on delete cascade,
  word_id        uuid references public.words (id) on delete set null,
  seq            smallint not null check (seq > 0),
  -- spelling: 뜻(+발음)을 보고 영어 철자 쓰기 / meaning: 영어를 보고 뜻 쓰기
  direction      text not null check (direction in ('spelling', 'meaning')),
  -- 출제 시점 스냅샷 (단어가 이후 수정·삭제돼도 결과는 불변 — 감사 추적)
  term           text not null,
  meaning        text not null,
  answer         text,
  is_correct     boolean,
  auto_correct   boolean,                 -- 자동 채점 원본 결과 (불변)
  overridden_by  uuid references auth.users (id) on delete set null,
  overridden_at  timestamptz,             -- 부모가 자동 채점과 다르게 판정한 시각
  unique (test_id, seq)
);
create index test_items_test_idx on public.test_items (test_id, seq);
create index test_items_word_idx on public.test_items (word_id);

-- 단어별 누적 통계 (제출된 시험만)
create view public.word_stats with (security_invoker = true) as
select i.family_id,
       i.word_id,
       count(*)::int                                     as attempts,
       count(*) filter (where i.is_correct = false)::int as wrong_count,
       max(t.submitted_at)                               as last_tested_at
  from public.test_items i
  join public.tests t on t.id = i.test_id
 where t.status = 'submitted'
   and i.word_id is not null
 group by i.family_id, i.word_id;

-- ---------------------------------------------------------------------
-- 접근 통제: 브라우저 롤은 아무 것도 못 한다
-- ---------------------------------------------------------------------
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.learners       enable row level security;
alter table public.words          enable row level security;
alter table public.tests          enable row level security;
alter table public.test_items     enable row level security;

revoke all on public.families, public.family_members, public.family_invites, public.learners,
              public.words, public.tests, public.test_items, public.word_stats
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 함수 (service_role 전용)
-- ---------------------------------------------------------------------

-- KST 기준 해당 주 월요일
create or replace function public.kst_week_start(p_at timestamptz default now())
returns date
language sql
stable
as $$
  select date_trunc('week', p_at at time zone 'Asia/Seoul')::date
$$;

-- 가족 생성 + 생성자를 부모로 등록
create or replace function public.create_family(p_user_id uuid, p_family_name text, p_display_name text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_family uuid;
begin
  if exists (select 1 from public.family_members where user_id = p_user_id) then
    raise exception 'ALREADY_IN_FAMILY' using errcode = 'P0001';
  end if;
  insert into public.families (name) values (btrim(p_family_name)) returning id into v_family;
  insert into public.family_members (family_id, user_id, display_name)
  values (v_family, p_user_id, btrim(p_display_name));
  return v_family;
end;
$$;

-- 초대코드로 가족 합류 (1회용, 만료 검사, 동시 사용 방지)
create or replace function public.join_family(p_user_id uuid, p_code_hash text, p_display_name text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_invite public.family_invites%rowtype;
begin
  if exists (select 1 from public.family_members where user_id = p_user_id) then
    raise exception 'ALREADY_IN_FAMILY' using errcode = 'P0001';
  end if;

  select * into v_invite from public.family_invites where code_hash = p_code_hash for update;
  if not found or v_invite.used_at is not null or v_invite.expires_at <= now() then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.family_members (family_id, user_id, display_name)
  values (v_invite.family_id, p_user_id, btrim(p_display_name));

  update public.family_invites set used_by = p_user_id, used_at = now() where id = v_invite.id;
  return v_invite.family_id;
end;
$$;

-- 시험 생성: 출제 대상 선정까지 DB에서 수행 (클라이언트/앱이 규칙을 우회할 수 없음)
--   regular: 등록 다음 날부터 + 정기 시험 미출제 단어 전부 (min_test_words 이상일 때만)
--   retest : p_parent_test_id 시험의 틀린 문항 (원래 출제 방향 유지)
create or replace function public.create_test(
  p_family_id      uuid,
  p_learner_id     uuid,
  p_kind           text,
  p_mode           text,
  p_parent_test_id uuid
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_today  date := (now() at time zone 'Asia/Seoul')::date;
  v_week   date := public.kst_week_start(now());
  v_learner public.learners%rowtype;
  v_used   int;
  v_count  int;
  v_test   uuid;
begin
  if p_mode not in ('spelling', 'meaning', 'mixed') then
    raise exception 'INVALID_MODE' using errcode = 'P0001';
  end if;

  -- 같은 자녀의 시험 생성 직렬화 (두 기기에서 동시에 시작 등)
  perform pg_advisory_xact_lock(hashtextextended('voca:create_test:' || p_learner_id::text, 0));

  select * into v_learner from public.learners where id = p_learner_id and family_id = p_family_id;
  if not found then
    raise exception 'LEARNER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.tests where learner_id = p_learner_id and status = 'in_progress') then
    raise exception 'TEST_IN_PROGRESS' using errcode = 'P0001';
  end if;

  create temporary table if not exists _picked (
    word_id uuid, direction text, term text, meaning text
  ) on commit drop;
  truncate _picked;

  if p_kind = 'regular' then
    select count(*) into v_used
      from public.tests
     where learner_id = p_learner_id
       and kind = 'regular'
       and status <> 'cancelled'
       and week_start = v_week;
    if v_used >= v_learner.weekly_limit then
      raise exception 'WEEKLY_LIMIT_REACHED' using errcode = 'P0001';
    end if;

    insert into _picked
    select w.id,
           case p_mode when 'mixed' then (case when random() < 0.5 then 'spelling' else 'meaning' end)
                       else p_mode end,
           w.term, w.meaning
      from public.words w
     where w.learner_id = p_learner_id
       and (w.created_at at time zone 'Asia/Seoul')::date < v_today
       and not exists (
         select 1
           from public.test_items i
           join public.tests t on t.id = i.test_id
          where i.word_id = w.id
            and t.kind = 'regular'
            and t.status <> 'cancelled'
       )
     -- 한 번에 최대 300개. 넘치면 먼저 등록한 단어부터 출제하고 나머지는 다음 시험으로
     order by w.created_at, w.id
     limit 300;

    get diagnostics v_count = row_count;
    if v_count < v_learner.min_test_words then
      raise exception 'NOT_ENOUGH_WORDS' using errcode = 'P0001',
        detail = format('%s/%s', v_count, v_learner.min_test_words);
    end if;

  elsif p_kind = 'retest' then
    if not exists (
      select 1 from public.tests
       where id = p_parent_test_id and learner_id = p_learner_id and status = 'submitted'
    ) then
      raise exception 'PARENT_TEST_NOT_FOUND' using errcode = 'P0001';
    end if;

    insert into _picked
    select i.word_id, i.direction, i.term, i.meaning
      from public.test_items i
     where i.test_id = p_parent_test_id and i.is_correct = false;

    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception 'NO_WRONG_ITEMS' using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_KIND' using errcode = 'P0001';
  end if;

  if v_count > 300 then
    raise exception 'TOO_MANY_WORDS' using errcode = 'P0001';
  end if;

  insert into public.tests (family_id, learner_id, kind, mode, parent_test_id, week_start, total)
  values (p_family_id, p_learner_id, p_kind, p_mode,
          case when p_kind = 'retest' then p_parent_test_id end, v_week, v_count)
  returning id into v_test;

  insert into public.test_items (test_id, family_id, word_id, seq, direction, term, meaning)
  select v_test, p_family_id, p.word_id,
         (row_number() over (order by random()))::smallint,
         p.direction, btrim(p.term), btrim(p.meaning)
    from _picked p;

  return v_test;
end;
$$;

-- 제출 + 채점 확정. 채점은 애플리케이션(순수 함수)에서 계산해 전달한다.
-- p_results: [{ "id": uuid, "answer": text, "is_correct": bool }, ...]
create or replace function public.submit_test(p_family_id uuid, p_test_id uuid, p_results jsonb)
returns smallint
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status   text;
  v_total    smallint;
  v_matched  int;
  v_correct  smallint;
begin
  select status, total into v_status, v_total
    from public.tests
   where id = p_test_id and family_id = p_family_id
   for update;

  if not found then
    raise exception 'TEST_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'TEST_NOT_IN_PROGRESS' using errcode = 'P0001';
  end if;

  with r as (
    select distinct on (x.id) x.*
      from jsonb_to_recordset(p_results) as x(id uuid, answer text, is_correct boolean)
  ), upd as (
    update public.test_items i
       set answer       = left(r.answer, 200),
           is_correct   = coalesce(r.is_correct, false),
           auto_correct = coalesce(r.is_correct, false)
      from r
     where i.id = r.id and i.test_id = p_test_id
    returning 1
  )
  select count(*) into v_matched from upd;

  -- 모든 문항이 정확히 한 번씩 채점되어야 한다 (부분 제출·남의 문항 id 차단)
  if v_matched <> v_total then
    raise exception 'RESULT_MISMATCH' using errcode = 'P0001';
  end if;

  select count(*) filter (where is_correct) into v_correct
    from public.test_items where test_id = p_test_id;

  update public.tests
     set status = 'submitted', correct = v_correct, submitted_at = now()
   where id = p_test_id;

  return v_correct;
end;
$$;

-- 부모의 정답 인정/취소. 누가 바꿨는지 기록하고 점수 재계산까지 한 트랜잭션.
create or replace function public.override_item(
  p_family_id uuid, p_user_id uuid, p_item_id uuid, p_is_correct boolean
)
returns smallint
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_test     uuid;
  v_correct  smallint;
begin
  select i.test_id into v_test
    from public.test_items i
    join public.tests t on t.id = i.test_id
   where i.id = p_item_id and i.family_id = p_family_id and t.status = 'submitted'
   for update of t;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.test_items
     set is_correct    = p_is_correct,
         overridden_by = case when p_is_correct is distinct from auto_correct then p_user_id end,
         overridden_at = case when p_is_correct is distinct from auto_correct then now() end
   where id = p_item_id;

  select count(*) filter (where is_correct) into v_correct
    from public.test_items where test_id = v_test;

  update public.tests set correct = v_correct where id = v_test;
  return v_correct;
end;
$$;

-- 부모 PIN 시도 기록 (5회 연속 실패 시 5분 잠금). 반환: 잠금 해제 시각(이번 시도로 잠긴 경우)
create or replace function public.record_pin_attempt(p_family_id uuid, p_success boolean)
returns timestamptz
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_locked timestamptz;
begin
  if p_success then
    update public.families
       set pin_failed_count = 0, pin_locked_until = null
     where id = p_family_id;
    return null;
  end if;

  update public.families
     set pin_failed_count = case when pin_failed_count + 1 >= 5 then 0 else pin_failed_count + 1 end,
         pin_locked_until = case when pin_failed_count + 1 >= 5 then now() + interval '5 minutes'
                                 else pin_locked_until end
   where id = p_family_id
  returning case when pin_failed_count = 0 then pin_locked_until end into v_locked;
  return v_locked;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_family(uuid, text, text)',
    'public.join_family(uuid, text, text)',
    'public.create_test(uuid, uuid, text, text, uuid)',
    'public.submit_test(uuid, uuid, jsonb)',
    'public.override_item(uuid, uuid, uuid, boolean)',
    'public.record_pin_attempt(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
