-- =============================================================
-- JurisLex Cycle B — observatoire + support graphe / analyses
-- =============================================================

-- Analyses liées dossier (prod Supabase)
create table if not exists public.matter_analyses (
  id            uuid primary key default gen_random_uuid(),
  matter_id     uuid not null references public.matters(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  narrative     text,
  payload       jsonb not null default '{}',
  confidence    int,
  overall_risk  text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_matter_analyses_matter on public.matter_analyses (matter_id);
create index if not exists idx_matter_analyses_owner on public.matter_analyses (owner_id);

alter table public.matter_analyses enable row level security;

drop policy if exists "analyses_owner" on public.matter_analyses;
create policy "analyses_owner" on public.matter_analyses
  for all to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.matters m
      where m.id = matter_id and public.can_access_matter(m)
    )
  )
  with check (owner_id = auth.uid());

-- Documents générés
create table if not exists public.generated_documents (
  id            uuid primary key default gen_random_uuid(),
  matter_id     uuid references public.matters(id) on delete set null,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  template_id   text not null,
  title         text not null,
  body          text,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

alter table public.generated_documents enable row level security;

drop policy if exists "gendoc_owner" on public.generated_documents;
create policy "gendoc_owner" on public.generated_documents
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Observatoire : versions de source et quarantaine
create table if not exists public.source_versions (
  id            uuid primary key default gen_random_uuid(),
  source_path   text not null,
  sha256        text not null,
  ingested_at   timestamptz not null default now(),
  note          text
);

create unique index if not exists idx_source_versions_path_sha
  on public.source_versions (source_path, sha256);

create table if not exists public.source_quarantine (
  source_path   text primary key,
  reason        text,
  quarantined_at timestamptz not null default now(),
  quarantined_by uuid references public.profiles(id) on delete set null
);

alter table public.source_quarantine enable row level security;

drop policy if exists "quarantine_read" on public.source_quarantine;
create policy "quarantine_read" on public.source_quarantine
  for select to authenticated
  using (true);

drop policy if exists "quarantine_write_admin" on public.source_quarantine;
create policy "quarantine_write_admin" on public.source_quarantine
  for all to authenticated
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

grant select, insert, update, delete on public.matter_analyses to authenticated;
grant select, insert, update, delete on public.generated_documents to authenticated;
grant select on public.source_versions to authenticated;
grant select, insert, update, delete on public.source_quarantine to authenticated;
