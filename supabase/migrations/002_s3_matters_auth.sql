-- =============================================================
-- JurisLex S3 — organisations, profils, dossiers, audit + RLS
-- Isolation stricte : un utilisateur ne lit que ses dossiers (ou org).
-- Idempotent.
-- =============================================================

-- Organisations
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  created_at  timestamptz not null default now()
);

-- Profils (1-1 avec auth.users)
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  role            text not null default 'standard'
                    check (role in ('standard', 'reviewer', 'admin')),
  barreau_number  text,
  org_id          uuid references public.organizations(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_profiles_org on public.profiles (org_id);

-- Auto-création profil à l'inscription
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
    coalesce(new.raw_user_meta_data->>'role', 'standard')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Dossiers
create table if not exists public.matters (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  org_id          uuid references public.organizations(id) on delete set null,
  reference       text not null,
  title           text not null,
  domain          text not null,
  status          text not null default 'draft'
                    check (status in ('draft','active','analysis','documented','closed','archived')),
  risk_level      text not null default 'medium'
                    check (risk_level in ('low','medium','high')),
  tags            text[] not null default '{}',
  analyses_count  int not null default 0,
  documents_count int not null default 0,
  assigned_to     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, reference)
);

create index if not exists idx_matters_owner on public.matters (owner_id);
create index if not exists idx_matters_org on public.matters (org_id);
create index if not exists idx_matters_status on public.matters (status);

-- Parties
create table if not exists public.matter_parties (
  id          uuid primary key default gen_random_uuid(),
  matter_id   uuid not null references public.matters(id) on delete cascade,
  name        text not null,
  quality     text,
  contact     text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_parties_matter on public.matter_parties (matter_id);

-- Preuves
create table if not exists public.matter_evidence (
  id          uuid primary key default gen_random_uuid(),
  matter_id   uuid not null references public.matters(id) on delete cascade,
  name        text not null,
  status      text not null default 'to_gather'
                check (status in ('available','to_gather','missing')),
  notes       text,
  created_at  timestamptz not null default now()
);

-- Journal d'audit (pas de PII libre dans meta)
create table if not exists public.audit_events (
  id            bigserial primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  action        text not null,
  resource_type text not null,
  resource_id   text,
  meta          jsonb not null default '{}',
  ip_hash       text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_user on public.audit_events (user_id);
create index if not exists idx_audit_resource on public.audit_events (resource_type, resource_id);

-- Helper : propriétaire ou même org
create or replace function public.can_access_matter(m public.matters)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    m.owner_id = auth.uid()
    or (
      m.org_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.org_id = m.org_id
      )
    );
$$;

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.matters enable row level security;
alter table public.matter_parties enable row level security;
alter table public.matter_evidence enable row level security;
alter table public.audit_events enable row level security;

-- Profiles : lecture/écriture de son propre profil
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or org_id in (select org_id from public.profiles where id = auth.uid() and org_id is not null));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Orgs : membres seulement
drop policy if exists "orgs_select_member" on public.organizations;
create policy "orgs_select_member" on public.organizations
  for select to authenticated
  using (id in (select org_id from public.profiles where id = auth.uid() and org_id is not null));

-- Matters
drop policy if exists "matters_select" on public.matters;
create policy "matters_select" on public.matters
  for select to authenticated
  using (public.can_access_matter(matters));

drop policy if exists "matters_insert" on public.matters;
create policy "matters_insert" on public.matters
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "matters_update" on public.matters;
create policy "matters_update" on public.matters
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "matters_delete" on public.matters;
create policy "matters_delete" on public.matters
  for delete to authenticated
  using (owner_id = auth.uid());

-- Parties / evidence via matter access
drop policy if exists "parties_all" on public.matter_parties;
create policy "parties_all" on public.matter_parties
  for all to authenticated
  using (
    exists (select 1 from public.matters m where m.id = matter_id and public.can_access_matter(m))
  )
  with check (
    exists (select 1 from public.matters m where m.id = matter_id and m.owner_id = auth.uid())
  );

drop policy if exists "evidence_all" on public.matter_evidence;
create policy "evidence_all" on public.matter_evidence
  for all to authenticated
  using (
    exists (select 1 from public.matters m where m.id = matter_id and public.can_access_matter(m))
  )
  with check (
    exists (select 1 from public.matters m where m.id = matter_id and m.owner_id = auth.uid())
  );

-- Audit : lecture de ses propres événements uniquement
drop policy if exists "audit_select_own" on public.audit_events;
create policy "audit_select_own" on public.audit_events
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "audit_insert_own" on public.audit_events;
create policy "audit_insert_own" on public.audit_events
  for insert to authenticated
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.matters to authenticated;
grant select, insert, update, delete on public.matter_parties to authenticated;
grant select, insert, update, delete on public.matter_evidence to authenticated;
grant select, insert on public.audit_events to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;
