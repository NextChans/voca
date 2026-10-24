-- 단어책 (자녀별, 선택 기능)
-- 1) word_books: 자녀별 단어책. 단어책을 만들지 않은 자녀는 지금과 똑같이 쓴다.
-- 2) words.book_id: 비어 있으면 "책 없음". 다른 자녀의 책에는 넣을 수 없다(복합 FK). 책을 지우면 단어는 "책 없음"으로.
-- 3) 단어책 시험(tests.kind = 'book'): 고른 책의 단어로 보는 추가 시험. 주간 횟수·정기 출제 여부에 영향 없음.
-- 한 트랜잭션으로 실행(전부 적용 또는 전부 취소). 기존 데이터는 바뀌지 않는다(새 칸은 모두 null).

begin;

-- ---------------------------------------------------------------- 단어책
create table if not exists public.word_books (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  learner_id  uuid not null references public.learners (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 30),
  created_at  timestamptz not null default now(),
  -- words/tests 의 복합 FK 대상: 책이 같은 자녀의 것인지 DB가 보장
  unique (learner_id, id)
);
create unique index if not exists word_books_learner_name_uniq on public.word_books (learner_id, lower(btrim(name)));

alter table public.word_books enable row level security;
revoke all on public.word_books from anon, authenticated;

-- 자녀당 단어책 30권 (자녀·단어 상한과 같은 문 단위 트리거)
create or replace function public.enforce_book_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
      from (select distinct learner_id from new_rows) n
     where (select count(*) from public.word_books b where b.learner_id = n.learner_id) > 30
  ) then
    raise exception 'BOOK_LIMIT';
  end if;
  return null;
end;
$$;

drop trigger if exists word_books_cap on public.word_books;
create trigger word_books_cap
  after insert on public.word_books
  referencing new table as new_rows
  for each statement execute function public.enforce_book_cap();

revoke all on function public.enforce_book_cap() from public, anon, authenticated;

-- ---------------------------------------------------------------- 단어 ↔ 단어책
alter table public.words add column if not exists book_id uuid;
alter table public.words drop constraint if exists words_book_fk;
-- ON DELETE SET NULL (book_id): 책을 지우면 book_id 만 비운다 (learner_id 는 그대로)
alter table public.words
  add constraint words_book_fk foreign key (learner_id, book_id)
  references public.word_books (learner_id, id) on delete set null (book_id);
create index if not exists words_learner_book_idx on public.words (learner_id, book_id);

-- ---------------------------------------------------------------- 단어책 시험
alter table public.tests drop constraint if exists tests_kind_check;
alter table public.tests add constraint tests_kind_check check (kind in ('regular', 'retest', 'book'));

alter table public.tests add column if not exists book_id uuid;
-- 출제 시점 책 이름 스냅샷 (책 이름이 바뀌거나 책이 지워져도 기록은 그대로)
alter table public.tests add column if not exists book_name text;
alter table public.tests drop constraint if exists tests_book_fk;
alter table public.tests
  add constraint tests_book_fk foreign key (learner_id, book_id)
  references public.word_books (learner_id, id) on delete set null (book_id);

-- create_test 에 p_book_id 추가 (기본값 null → 기존 5개 인자 호출도 그대로 동작)
drop function if exists public.create_test(uuid, uuid, text, text, uuid);

--   regular: 등록 다음 날부터 + 정기 시험 미출제 단어 전부 (min_test_words 이상일 때만)
--   retest : p_parent_test_id 시험의 틀린 문항 (원래 출제 방향 유지, 원래 시험의 책 정보 이어받음)
--   book   : p_book_id 책의 단어 전부 (등록일·출제 여부 무관, 300개 넘으면 무작위 300개). 주간 횟수에 포함되지 않음
create or replace function public.create_test(
  p_family_id      uuid,
  p_learner_id     uuid,
  p_kind           text,
  p_mode           text,
  p_parent_test_id uuid,
  p_book_id        uuid default null
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
  v_book_id   uuid;
  v_book_name text;
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
    select book_id, book_name into v_book_id, v_book_name
      from public.tests
     where id = p_parent_test_id and learner_id = p_learner_id and status = 'submitted';
    if not found then
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

  elsif p_kind = 'book' then
    select id, name into v_book_id, v_book_name
      from public.word_books
     where id = p_book_id and learner_id = p_learner_id and family_id = p_family_id;
    if not found then
      raise exception 'BOOK_NOT_FOUND' using errcode = 'P0001';
    end if;

    insert into _picked
    select w.id,
           case p_mode when 'mixed' then (case when random() < 0.5 then 'spelling' else 'meaning' end)
                       else p_mode end,
           w.term, w.meaning
      from public.words w
     where w.learner_id = p_learner_id and w.book_id = v_book_id
     order by random()
     limit 300;

    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception 'NO_BOOK_WORDS' using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_KIND' using errcode = 'P0001';
  end if;

  if v_count > 300 then
    raise exception 'TOO_MANY_WORDS' using errcode = 'P0001';
  end if;

  insert into public.tests (family_id, learner_id, kind, mode, parent_test_id, week_start, total, book_id, book_name)
  values (p_family_id, p_learner_id, p_kind, p_mode,
          case when p_kind = 'retest' then p_parent_test_id end, v_week, v_count,
          v_book_id, v_book_name)
  returning id into v_test;

  insert into public.test_items (test_id, family_id, word_id, seq, direction, term, meaning)
  select v_test, p_family_id, p.word_id,
         (row_number() over (order by random()))::smallint,
         p.direction, btrim(p.term), btrim(p.meaning)
    from _picked p;

  return v_test;
end;
$$;

revoke all on function public.create_test(uuid, uuid, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_test(uuid, uuid, text, text, uuid, uuid) to service_role;

commit;
