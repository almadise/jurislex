-- =============================================================
-- JurisLex S0 — fondations recherche & statut prudent
-- Idempotent : safe to re-run.
-- =============================================================

-- Statut juridique CDC (ne pas inférer « en vigueur » sans preuve)
alter table public.legal_documents
  add column if not exists legal_status text not null default 'unknown';

alter table public.legal_documents
  add column if not exists status_justification text;

-- Provenance : official | secondary | unknown
alter table public.legal_documents
  add column if not exists provenance text not null default 'unknown';

-- Langue explicite (déjà langue sur docs ; s'assurer)
alter table public.legal_documents
  add column if not exists langue text not null default 'fr';

comment on column public.legal_documents.legal_status is
  'verified | probable | unknown | repealed | superseded — jamais verified sans audit';
comment on column public.legal_documents.provenance is
  'official | secondary | unknown';

-- Migrer legacy statut → legal_status (prudent)
update public.legal_documents
set legal_status = case
  when statut = 'abroge' then 'repealed'
  when statut = 'modifie' then 'superseded'
  when statut = 'en_vigueur' then 'probable'
  else coalesce(nullif(legal_status, ''), 'unknown')
end
where legal_status = 'unknown' or legal_status is null;

-- Inférer secondaire depuis le chemin
update public.legal_documents
set provenance = 'secondary'
where provenance = 'unknown'
  and (
    source_path ilike '%source_secondaire%'
    or source_path ilike '%secondaire%'
    or titre ilike '%compilation%'
  );

update public.legal_documents
set provenance = 'official'
where provenance = 'unknown'
  and source_path is not null
  and source_path <> '';

create index if not exists idx_docs_legal_status on public.legal_documents (legal_status);
create index if not exists idx_docs_provenance on public.legal_documents (provenance);
create index if not exists idx_docs_numero on public.legal_documents (numero);

-- get_article plus tolérant (variants de numéro partiels)
create or replace function public.get_article(
  p_numero_texte text,
  p_article      text
)
returns table (
  titre text,
  article_label text,
  contenu text,
  source_path text,
  page_debut int,
  document_id uuid,
  chunk_id bigint
)
language sql
stable
as $$
  select
    d.titre,
    c.article_label,
    c.contenu,
    d.source_path,
    c.page_debut,
    d.id,
    c.id
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
  order by c.chunk_index;
$$;

grant execute on function public.get_article to anon, authenticated;
