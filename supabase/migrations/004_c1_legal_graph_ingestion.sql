-- =============================================================
-- JurisLex Cycle C1 — graphe juridique CDC + jobs d'ingestion
-- + correctif sécurité : pas d'élévation de rôle à l'inscription
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 0. Correctif auth : handle_new_user ignore raw_user_meta_data.role
--    Seul un admin (SQL / service_role) peut promouvoir un profil.
-- -------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, barreau_number)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'standard',  -- JAMAIS depuis le client / metadata
    nullif(new.raw_user_meta_data->>'barreau_number', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Promotion de rôle : callable uniquement par service_role ou admin authentifié
create or replace function public.promote_user_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('standard', 'reviewer', 'admin') then
    raise exception 'role invalide: %', p_role;
  end if;
  -- Seul un admin déjà promu, ou le contexte service_role (auth.uid null + JWT role)
  if auth.uid() is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'promotion réservée aux administrateurs';
    end if;
  end if;
  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.promote_user_role(uuid, text) from public;
grant execute on function public.promote_user_role(uuid, text) to authenticated, service_role;

-- -------------------------------------------------------------
-- 1. Famille de documents (même acte, plusieurs versions JO)
-- -------------------------------------------------------------
alter table public.legal_documents
  add column if not exists document_family_id uuid;

create index if not exists idx_docs_family
  on public.legal_documents (document_family_id)
  where document_family_id is not null;

-- -------------------------------------------------------------
-- 2. Versions documentaires riches
-- -------------------------------------------------------------
create table if not exists public.legal_document_versions (
  id                 uuid primary key default gen_random_uuid(),
  document_family_id uuid not null,
  document_id        uuid references public.legal_documents(id) on delete set null,
  version_label      text not null,          -- ex. 'JO 2014', 'rectificatif 2015'
  effective_from     date,
  effective_to       date,                   -- null = ouvert / inconnu
  is_consolidated    boolean not null default false,
  source_path        text,
  sha256             text,
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_doc_versions_family
  on public.legal_document_versions (document_family_id);
create index if not exists idx_doc_versions_doc
  on public.legal_document_versions (document_id);
create unique index if not exists idx_doc_versions_family_label
  on public.legal_document_versions (document_family_id, version_label);

-- -------------------------------------------------------------
-- 3. Relations juridiques (CDC LegalRelation)
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

-- Unicité relation (articles null traités comme '')
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
create index if not exists idx_legal_relations_type on public.legal_relations (relation_type);

-- -------------------------------------------------------------
-- 4. Versionnement d'articles (texte dans le temps)
-- -------------------------------------------------------------
create table if not exists public.legal_article_versions (
  id             bigserial primary key,
  document_id    uuid not null references public.legal_documents(id) on delete cascade,
  article_num    text not null,
  article_label  text,
  contenu        text not null,
  effective_from date,
  effective_to   date,
  chunk_id       bigint references public.legal_chunks(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_article_versions_doc_art
  on public.legal_article_versions (document_id, article_num);
create unique index if not exists idx_article_versions_unique
  on public.legal_article_versions (
    document_id,
    article_num,
    coalesce(effective_from, '1900-01-01'::date)
  );

-- -------------------------------------------------------------
-- 5. Jobs d'ingestion + scores qualité (C1 worker)
-- -------------------------------------------------------------
create table if not exists public.ingestion_jobs (
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

create index if not exists idx_ingestion_jobs_status
  on public.ingestion_jobs (status, priority, created_at);

create table if not exists public.ingestion_quality_reports (
  id              uuid primary key default gen_random_uuid(),
  source_path     text not null,
  document_slug   text,
  job_id          uuid references public.ingestion_jobs(id) on delete set null,
  score           numeric(5,2) not null,          -- 0–100
  flags           jsonb not null default '[]',    -- [{code, severity, message}]
  metrics         jsonb not null default '{}',    -- nb_pages, pct_articles, etc.
  quarantined     boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_quality_source on public.ingestion_quality_reports (source_path);
create index if not exists idx_quality_score  on public.ingestion_quality_reports (score);

-- -------------------------------------------------------------
-- 6. RLS
-- -------------------------------------------------------------
alter table public.legal_document_versions enable row level security;
alter table public.legal_relations enable row level security;
alter table public.legal_article_versions enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.ingestion_quality_reports enable row level security;

-- Lecture publique corpus (comme legal_documents)
drop policy if exists "lecture versions docs" on public.legal_document_versions;
create policy "lecture versions docs"
  on public.legal_document_versions for select
  to anon, authenticated
  using (true);

drop policy if exists "lecture relations" on public.legal_relations;
create policy "lecture relations"
  on public.legal_relations for select
  to anon, authenticated
  using (true);

drop policy if exists "lecture article versions" on public.legal_article_versions;
create policy "lecture article versions"
  on public.legal_article_versions for select
  to anon, authenticated
  using (true);

-- Écriture relations : reviewer / admin uniquement
drop policy if exists "write relations reviewer" on public.legal_relations;
create policy "write relations reviewer"
  on public.legal_relations for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'reviewer')
    )
  );

-- Jobs : créateur ou admin lit ; service_role (worker) contourne RLS
drop policy if exists "jobs_select_own" on public.ingestion_jobs;
create policy "jobs_select_own"
  on public.ingestion_jobs for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'reviewer')
    )
  );

drop policy if exists "jobs_insert_auth" on public.ingestion_jobs;
create policy "jobs_insert_auth"
  on public.ingestion_jobs for insert
  to authenticated
  with check (created_by = auth.uid() or created_by is null);

drop policy if exists "quality_read_auth" on public.ingestion_quality_reports;
create policy "quality_read_auth"
  on public.ingestion_quality_reports for select
  to authenticated
  using (true);

grant select on public.legal_document_versions to anon, authenticated;
grant select on public.legal_relations to anon, authenticated;
grant select, insert, update on public.legal_relations to authenticated;
grant select on public.legal_article_versions to anon, authenticated;
grant select, insert on public.ingestion_jobs to authenticated;
grant select on public.ingestion_quality_reports to authenticated;

-- -------------------------------------------------------------
-- 7. Helper : article en vigueur à une date (as_of)
-- -------------------------------------------------------------
create or replace function public.get_article_as_of(
  p_numero_texte text,
  p_article      text,
  p_as_of        date default current_date
)
returns table (
  titre text,
  article_label text,
  contenu text,
  source_path text,
  page_debut int,
  document_id uuid,
  chunk_id bigint,
  effective_from date,
  effective_to date,
  from_version boolean
)
language sql
stable
as $$
  -- Préférer une version d'article datée si disponible
  (
    select
      d.titre,
      coalesce(av.article_label, c.article_label) as article_label,
      av.contenu,
      d.source_path,
      c.page_debut,
      d.id as document_id,
      av.chunk_id,
      av.effective_from,
      av.effective_to,
      true as from_version
    from public.legal_article_versions av
    join public.legal_documents d on d.id = av.document_id
    left join public.legal_chunks c on c.id = av.chunk_id
    where (
        d.numero = p_numero_texte
        or replace(d.numero, '/', '-') = replace(p_numero_texte, '/', '-')
        or d.numero like '%' || p_numero_texte || '%'
      )
      and (
        av.article_num = p_article
        or lower(replace(av.article_num, ' ', '')) = lower(replace(p_article, ' ', ''))
      )
      and (av.effective_from is null or av.effective_from <= p_as_of)
      and (av.effective_to is null or av.effective_to >= p_as_of)
    order by av.effective_from desc nulls last
    limit 1
  )
  union all
  (
    select
      d.titre,
      c.article_label,
      c.contenu,
      d.source_path,
      c.page_debut,
      d.id,
      c.id,
      null::date,
      null::date,
      false
    from public.legal_chunks c
    join public.legal_documents d on d.id = c.document_id
    where (
        d.numero = p_numero_texte
        or replace(d.numero, '/', '-') = replace(p_numero_texte, '/', '-')
        or d.numero like '%' || p_numero_texte || '%'
      )
      and (
        c.article_num = p_article
        or lower(replace(c.article_num, ' ', '')) = lower(replace(p_article, ' ', ''))
      )
      and not exists (
        select 1 from public.legal_article_versions av2
        where av2.document_id = d.id
          and (
            av2.article_num = p_article
            or lower(replace(av2.article_num, ' ', '')) = lower(replace(p_article, ' ', ''))
          )
          and (av2.effective_from is null or av2.effective_from <= p_as_of)
          and (av2.effective_to is null or av2.effective_to >= p_as_of)
      )
    order by c.chunk_index
    limit 1
  )
  limit 1;
$$;

grant execute on function public.get_article_as_of to anon, authenticated;

-- -------------------------------------------------------------
-- 8. Relations d'un document
-- -------------------------------------------------------------
create or replace function public.get_legal_relations(p_document_id uuid)
returns setof public.legal_relations
language sql
stable
as $$
  select *
  from public.legal_relations
  where from_document_id = p_document_id
     or to_document_id = p_document_id
  order by relation_type, created_at;
$$;

grant execute on function public.get_legal_relations to anon, authenticated;
