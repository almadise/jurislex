-- =============================================================
-- JurisLex C2c — file éditoriale (revue juriste)
-- Idempotent.
-- =============================================================

create table if not exists public.editorial_queue (
  id              uuid primary key default gen_random_uuid(),
  item_type       text not null
                    check (item_type in ('document','relation','chunk','rule','source_update')),
  status          text not null default 'pending'
                    check (status in ('pending','in_review','approved','rejected','quarantined')),
  title           text not null,
  source_path     text,
  document_slug   text,
  relation_id     uuid references public.legal_relations(id) on delete set null,
  rule_id         text,
  assignee_id     uuid references public.profiles(id) on delete set null,
  priority        int not null default 100,
  checklist       jsonb not null default '{
    "provenanceChecked": false,
    "legalStatusChecked": false,
    "relationsChecked": false,
    "qualityChecked": false
  }'::jsonb,
  notes           jsonb not null default '[]',
  payload         jsonb not null default '{}',
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_editorial_status on public.editorial_queue (status, priority, updated_at);
create index if not exists idx_editorial_assignee on public.editorial_queue (assignee_id);
create index if not exists idx_editorial_source on public.editorial_queue (source_path);

create table if not exists public.editorial_actions (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.editorial_queue(id) on delete cascade,
  action          text not null
                    check (action in (
                      'create','assign','approve','reject','quarantine','request_info','note'
                    )),
  note            text,
  by_user_id      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_editorial_actions_item on public.editorial_actions (item_id, created_at);

alter table public.editorial_queue enable row level security;
alter table public.editorial_actions enable row level security;

-- Lecture : authenticated ; écriture reviewer/admin
drop policy if exists "editorial_read" on public.editorial_queue;
create policy "editorial_read" on public.editorial_queue
  for select to authenticated using (true);

drop policy if exists "editorial_write_reviewer" on public.editorial_queue;
create policy "editorial_write_reviewer" on public.editorial_queue
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

drop policy if exists "editorial_actions_read" on public.editorial_actions;
create policy "editorial_actions_read" on public.editorial_actions
  for select to authenticated using (true);

drop policy if exists "editorial_actions_write" on public.editorial_actions;
create policy "editorial_actions_write" on public.editorial_actions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'reviewer')
    )
  );

grant select on public.editorial_queue to authenticated;
grant select, insert, update on public.editorial_queue to authenticated;
grant select, insert on public.editorial_actions to authenticated;
