-- =====================================================================
-- 자녀 로그인 계정
--   * 부모가 자녀마다 아이디/비밀번호 계정을 만들어 준다 (Supabase Auth 사용자, 이메일 인증 없음).
--   * learners.user_id 로 연결. 자녀 계정은 family_members 에 들어가지 않으며 부모 권한이 없다.
--   * 한 Auth 사용자는 부모(family_members) 또는 자녀(learners) 중 하나만 될 수 있다.
-- =====================================================================

alter table public.learners
  add column user_id uuid unique references auth.users (id) on delete set null,
  add column login_id text unique check (login_id ~ '^[a-z0-9_]{3,20}$');

-- 부모 계정이 자녀로, 자녀 계정이 부모로 연결되는 것을 막는다
create or replace function public.ensure_single_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'family_members' then
    if exists (select 1 from public.learners where user_id = new.user_id) then
      raise exception 'ACCOUNT_IS_LEARNER' using errcode = 'P0001';
    end if;
  elsif new.user_id is not null then
    if exists (select 1 from public.family_members where user_id = new.user_id) then
      raise exception 'ACCOUNT_IS_PARENT' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger family_members_single_role
  before insert or update of user_id on public.family_members
  for each row execute function public.ensure_single_role();

create trigger learners_single_role
  before insert or update of user_id on public.learners
  for each row execute function public.ensure_single_role();

revoke all on function public.ensure_single_role() from public, anon, authenticated;
