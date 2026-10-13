-- =============================================================
-- JurisLex C1 — adaptation STAGING projet jurisLex (mwvogydwkxjngngqlqgx)
-- Schéma distant réel : user_profiles (pas profiles), legal_provisions,
-- legal_text_versions, review_items, ingestion_jobs (autre forme).
--
-- Objectif : LegalRelation CDC + versions + anti-élévation + compat app Next.
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 0. Compatibilité public.profiles pour l'app Next (migration 002 locale)
--    Miroir de user_profiles + mapping de rôles.
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  role            text not null default 'standard'
                    check (role in ('standard', 'reviewer', 'admin', 'lawyer')),
  barreau_number  text,
  org_id          uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Synchroniser depuis user_profiles existants
insert into public.profiles (id, email, full_name, role, created_at, updated_at)
select
  up.id,
  up.email,
  up.full_name,
  case
    when lower(coalesce(up.role, '')) in ('admin') then 'admin'
    when lower(coalesce(up.role, '')) in ('reviewer', 'lawyer', 'juriste') then 'reviewer'
    else 'standard'
  end,
  coalesce(up.created_at, now()),
  coalesce(up.updated_at, now())
from public.user_profiles up
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = case
    when public.profiles.role = 'admin' then 'admin'
    else excluded.role
  end,
  updated_at = now();

-- Trigger inscription : toujours standard (pas d'élévation client)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'standard'
  )
  on conflict (id) do nothing;

  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'standard'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Promotion de rôle (admin ou service_role)
create or replace function public.promote_user_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := lower(p_role);
  if v_role not in ('standard', 'reviewer', 'admin', 'lawyer') then
    raise exception 'role invalide: %', p_role;
  end if;
  -- normaliser lawyer → reviewer côté profiles app
  if v_role = 'lawyer' then
    v_role := 'reviewer';
  end if;

  if auth.uid() is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    ) and not exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and lower(up.role) = 'admin'
    ) then
      raise exception 'promotion réservée aux administrateurs';
    end if;
  end if;

  update public.profiles
  set role = v_role, updated_at = now()
  where id = p_user_id;

  update public.user_profiles
  set role = case when v_role = 'reviewer' then 'lawyer' else v_role end,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.promote_user_role(uuid, text) from public;
grant execute on function public.promote_user_role(uuid, text) to authenticated, service_role;

-- -------------------------------------------------------------
-- 1. Colonnes CDC sur legal_documents
-- -------------------------------------------------------------
alter table public.legal_documents
  add column if not exists document_family_id uuid;

alter table public.legal_documents
  add column if not exists legal_status text default 'unknown';

alter table public.legal_documents
  add column if not exists status_justification text;

alter table public.legal_documents
  add column if not exists provenance text default 'unknown';

create index if not exists idx_docs_family
  on public.legal_documents (document_family_id)
  where document_family_id is not null;

-- -------------------------------------------------------------
-- 2. Versions documentaires (complète legal_text_versions existant)
-- -------------------------------------------------------------
create table if not exists public.legal_document_versions (
  id                 uuid primary key default gen_random_uuid(),
  document_family_id uuid not null,
  document_id        uuid references public.legal_documents(id) on delete set null,
  version_label      text not null,
  effective_from     date,
  effective_to       date,
  is_consolidated    boolean not null default false,
  source_path        text,
  sha256             text,
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_doc_versions_family
  on public.legal_document_versions (document_family_id);
create unique index if not exists idx_doc_versions_family_label
  on public.legal_document_versions (document_family_id, version_label);

-- -------------------------------------------------------------
-- 3. LegalRelation CDC
-- -------------------------------------------------------------
create table if not exists public.legal_relations (
  id               uuid primary key default gen_random_uuid(),
  from_document_id uuid not null references public.legal_documents(id) on delete cascade,
  to_document_id   uuid not null references public.legal_documents(id) on delete cascade,
  relation_type    text not null
                     check (relation_type in (
                       'abrogates', 'amends', 'refers_to', 'implements',
                       'supersedes', 'consolidates', 'conflicts_with', 'cites'
                     )),
  from_article     text,
  to_article       text,
  confidence       text not null default 'unknown'
                     check (confidence in ('verified', 'probable', 'unknown')),
  justification    text,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint legal_relations_no_self check (from_document_id <> to_document_id)
);

create unique index if not exists idx_legal_relations_unique
  on public.legal_relations (
    from_document_id,
    to_document_id,
    relation_type,
    coalesce(from_article, ''),
    coalesce(to_article, '')
  );

create index if not exists idx_legal_relations_from on public.legal_relations (from_document_id);
create index if not exists idx_legal_relations_to   on public.legal_relations (to_document_id);

-- -------------------------------------------------------------
-- 4. Versions d'articles
-- -------------------------------------------------------------
create table if not exists public.legal_article_versions (
  id             bigserial primary key,
  document_id    uuid not null references public.legal_documents(id) on delete cascade,
  article_num    text not null,
  article_label  text,
  contenu        text not null,
  effective_from date,
  effective_to   date,
  chunk_id       bigint,
  created_at     timestamptz not null default now()
);

-- chunk_id sans FK stricte (legal_chunks id peut être uuid ou bigserial selon historique)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='legal_chunks' and column_name='id'
      and data_type in ('bigint', 'integer', 'smallint')
  ) then
    begin
      alter table public.legal_article_versions
        add constraint legal_article_versions_chunk_fk
        foreign key (chunk_id) references public.legal_chunks(id) on delete set null;
    exception when others then
      null;
    end;
  end if;
end $$;

create index if not exists idx_article_versions_doc_art
  on public.legal_article_versions (document_id, article_num);

create unique index if not exists idx_article_versions_unique
  on public.legal_article_versions (
    document_id,
    article_num,
    coalesce(effective_from, '1900-01-01'::date)
  );

-- -------------------------------------------------------------
-- 5. Jobs d'ingestion C1 (si la table existante a une autre forme, table parallèle)
-- -------------------------------------------------------------
create table if not exists public.ingestion_jobs_c1 (
  id            uuid primary key default gen_random_uuid(),
  job_type      text not null
                  check (job_type in ('verify', 'ocr', 'extract', 'upload', 'pipeline', 'quality')),
  status        text not null default 'queued'
                  check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  priority      int not null default 100,
  payload       jsonb not null default '{}',
  progress      jsonb not null default '{}',
  result        jsonb,
  error         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create table if not exists public.ingestion_quality_reports (
  id              uuid primary key default gen_random_uuid(),
  source_path     text not null,
  document_slug   text,
  job_id          uuid,
  score           numeric(5,2) not null,
  flags           jsonb not null default '[]',
  metrics         jsonb not null default '{}',
  quarantined     boolean not null default false,
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 6. RLS lecture corpus
-- -------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_relations enable row level security;
alter table public.legal_article_versions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or true);

drop policy if exists "lecture versions docs" on public.legal_document_versions;
create policy "lecture versions docs"
  on public.legal_document_versions for select
  to anon, authenticated using (true);

drop policy if exists "lecture relations" on public.legal_relations;
create policy "lecture relations"
  on public.legal_relations for select
  to anon, authenticated using (true);

drop policy if exists "write relations reviewer" on public.legal_relations;
create policy "write relations reviewer"
  on public.legal_relations for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','reviewer'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','reviewer'))
  );

drop policy if exists "lecture article versions" on public.legal_article_versions;
create policy "lecture article versions"
  on public.legal_article_versions for select
  to anon, authenticated using (true);

grant select on public.legal_document_versions to anon, authenticated;
grant select on public.legal_relations to anon, authenticated;
grant select, insert, update on public.legal_relations to authenticated;
grant select on public.legal_article_versions to anon, authenticated;
grant select on public.profiles to authenticated;

-- -------------------------------------------------------------
-- 7. RPC helpers
-- -------------------------------------------------------------
create or replace function public.get_legal_relations(p_document_id uuid)
returns setof public.legal_relations
language sql stable as $$
  select * from public.legal_relations
  where from_document_id = p_document_id or to_document_id = p_document_id
  order by relation_type, created_at;
$$;

grant execute on function public.get_legal_relations to anon, authenticated;
