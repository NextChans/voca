-- 일반 공개 준비 (PR 1)
-- 1) 약관·개인정보 동의 기록 (감사 추적용 이력 + 부모별 최신 동의 버전)
-- 2) 회원 탈퇴: 마지막 부모가 탈퇴하면 가족 전체 삭제

-- ---------------------------------------------------------------- 동의 이력
create table public.user_consents (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  version    text not null check (char_length(version) between 1 and 20),
  kinds      text[] not null,
  agreed_at  timestamptz not null default now()
);
create index user_consents_user_idx on public.user_consents (user_id, agreed_at desc);

alter table public.user_consents enable row level security;
revoke all on public.user_consents from anon, authenticated;

-- 부모가 마지막으로 동의한 문서 버전 (요청마다 이력 테이블을 조회하지 않도록)
alter table public.family_members add column consent_version text;

-- 필수 동의 항목이 모두 있어야 기록. 이력 추가와 최신 버전 갱신을 한 트랜잭션으로.
create or replace function public.record_consent(p_user_id uuid, p_version text, p_kinds text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (p_kinds @> array['terms', 'privacy', 'overseas_transfer', 'guardian']) then
    raise exception 'CONSENT_INCOMPLETE';
  end if;
  insert into public.user_consents (user_id, version, kinds) values (p_user_id, p_version, p_kinds);
  update public.family_members set consent_version = p_version where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------- 회원 탈퇴
-- 다른 부모가 남아 있으면 본인 소속만 삭제, 마지막 부모면 가족 전체(자녀·단어·시험) 삭제.
-- 자녀 로그인 계정(auth.users)은 DB 함수가 지울 수 없으므로 id 목록을 돌려주고 앱이 Auth Admin API 로 삭제한다.
-- 두 부모가 동시에 탈퇴해도 가족 행 잠금으로 직렬화되어 가족이 남지 않는다.
create or replace function public.delete_parent_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_others int;
  v_kids   uuid[];
begin
  select family_id into v_family from public.family_members where user_id = p_user_id;
  if v_family is null then
    return jsonb_build_object('family_deleted', false, 'kid_user_ids', '[]'::jsonb);
  end if;

  perform 1 from public.families where id = v_family for update;

  select count(*) into v_others
    from public.family_members where family_id = v_family and user_id <> p_user_id;

  if v_others > 0 then
    delete from public.family_members where user_id = p_user_id;
    return jsonb_build_object('family_deleted', false, 'kid_user_ids', '[]'::jsonb);
  end if;

  select coalesce(array_agg(user_id), '{}') into v_kids
    from public.learners where family_id = v_family and user_id is not null;
  delete from public.families where id = v_family;
  return jsonb_build_object('family_deleted', true, 'kid_user_ids', to_jsonb(v_kids));
end;
$$;

revoke all on function public.record_consent(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.record_consent(uuid, text, text[]) to service_role;
revoke all on function public.delete_parent_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_parent_account(uuid) to service_role;
