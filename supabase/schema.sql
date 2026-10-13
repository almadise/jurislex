-- =============================================================
-- JurisLex — Base légale (Cameroun / OHADA / CEMAC / COBAC / CIMA / OAPI)
-- Schéma Supabase + pgvector
-- À exécuter dans Supabase Studio > SQL Editor
-- =============================================================

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- -------------------------------------------------------------
-- Configuration FTS française insensible aux accents
-- -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'fr_unaccent') then
    create text search configuration fr_unaccent (copy = french);
    alter text search configuration fr_unaccent
      alter mapping for hword, hword_part, word
      with unaccent, french_stem;
  end if;
end $$;

-- =============================================================
-- 1. DOCUMENTS
-- =============================================================
create table if not exists public.legal_documents (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  titre         text not null,

  -- Qualification juridique
  type_acte     text,        -- Loi | Décret | Ordonnance | Arrêté | Règlement | Acte uniforme | Circulaire | Instruction | Décision
  numero        text,        -- ex. '2016-007', 'R-2010-01'
  date_texte    date,
  juridiction   text,        -- Cameroun | OHADA | CEMAC | COBAC | CIMA | OAPI | UDEAC
  categorie     text,        -- dossier source, ex. '10_Penal_specialise'
  matiere       text[],      -- tags libres: foncier, sociétés, fiscal...

  -- Traçabilité
  source_path   text not null,
  sha256        text,
  nb_pages      int,
  ocr           boolean not null default false,
  langue        text not null default 'fr',

  -- Cycle de vie legacy (conservé pour compat pipeline)
  statut        text not null default 'unknown',  -- unknown | en_vigueur | abroge | modifie
  abroge_par    uuid references public.legal_documents(id) on delete set null,

  -- Statut juridique prudent (CDC) — jamais « verified » sans audit
  legal_status  text not null default 'unknown',  -- verified | probable | unknown | repealed | superseded
  status_justification text,
  -- Provenance documentaire
  provenance    text not null default 'unknown',  -- official | secondary | unknown

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_docs_juridiction on public.legal_documents (juridiction);
create index if not exists idx_docs_type        on public.legal_documents (type_acte);
create index if not exists idx_docs_categorie   on public.legal_documents (categorie);
create index if not exists idx_docs_statut      on public.legal_documents (statut);
create index if not exists idx_docs_legal_status on public.legal_documents (legal_status);
create index if not exists idx_docs_provenance  on public.legal_documents (provenance);
create index if not exists idx_docs_numero      on public.legal_documents (numero);
create index if not exists idx_docs_matiere     on public.legal_documents using gin (matiere);
create index if not exists idx_docs_titre_trgm  on public.legal_documents using gin (titre gin_trgm_ops);

-- =============================================================
-- 2. CHUNKS
-- Granularité = article quand détectable, sinon fenêtre de texte.
-- L'article est la maille de citation en droit : ne jamais le
-- découper arbitrairement, sinon la citation devient fausse.
-- =============================================================
create table if not exists public.legal_chunks (
  id            bigserial primary key,
  document_id   uuid not null references public.legal_documents(id) on delete cascade,
  chunk_index   int not null,

  article_num   text,        -- '5', '12 bis', '34 nouveau'
  article_label text,        -- 'Article 12 bis'
  contenu       text not null,
  nb_tokens     int,
  page_debut    int,
  page_fin      int,

  embedding     vector(1536),   -- text-embedding-3-small

  fts tsvector generated always as (
    to_tsvector('fr_unaccent', coalesce(article_label,'') || ' ' || contenu)
  ) stored,

  created_at    timestamptz not null default now(),

  unique (document_id, chunk_index)
);

-- HNSW : recherche vectorielle rapide en cosinus.
-- Créer APRÈS le chargement initial pour accélérer l'ingestion.
create index if not exists idx_chunks_embedding
  on public.legal_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists idx_chunks_fts      on public.legal_chunks using gin (fts);
create index if not exists idx_chunks_doc      on public.legal_chunks (document_id);
create index if not exists idx_chunks_article  on public.legal_chunks (document_id, article_num);

-- =============================================================
-- 3. RECHERCHE HYBRIDE (vectorielle + plein texte, fusion RRF)
-- Le lexique juridique OHADA contient beaucoup de termes exacts
-- ("nantissement", "AUSCGIE", "R-2010-01") que le vectoriel seul
-- rate. La fusion des deux rangs corrige ça.
-- =============================================================
create or replace function public.search_legal_base(
  query_text        text,
  query_embedding   vector(1536),
  match_count       int     default 12,
  filtre_juridiction text   default null,
  filtre_categorie  text    default null,
  rrf_k             int     default 50
)
returns table (
  chunk_id      bigint,
  document_id   uuid,
  titre         text,
  type_acte     text,
  numero        text,
  juridiction   text,
  categorie     text,
  article_label text,
  contenu       text,
  page_debut    int,
  source_path   text,
  score         float
)
language sql
stable
as $$
with
vect as (
  select c.id, row_number() over (order by c.embedding <=> query_embedding) as rang
  from public.legal_chunks c
  join public.legal_documents d on d.id = c.document_id
  where c.embedding is not null
    and d.statut <> 'abroge'
    and (filtre_juridiction is null or d.juridiction = filtre_juridiction)
    and (filtre_categorie   is null or d.categorie   = filtre_categorie)
  order by c.embedding <=> query_embedding
  limit match_count * 4
),
texte as (
  select c.id,
         row_number() over (
           order by ts_rank_cd(c.fts, websearch_to_tsquery('fr_unaccent', query_text)) desc
         ) as rang
  from public.legal_chunks c
  join public.legal_documents d on d.id = c.document_id
  where c.fts @@ websearch_to_tsquery('fr_unaccent', query_text)
    and d.statut <> 'abroge'
    and (filtre_juridiction is null or d.juridiction = filtre_juridiction)
    and (filtre_categorie   is null or d.categorie   = filtre_categorie)
  limit match_count * 4
)
select
  c.id, d.id, d.titre, d.type_acte, d.numero, d.juridiction, d.categorie,
  c.article_label, c.contenu, c.page_debut, d.source_path,
  (coalesce(1.0 / (rrf_k + vect.rang), 0.0)
 + coalesce(1.0 / (rrf_k + texte.rang), 0.0))::float as score
from public.legal_chunks c
join public.legal_documents d on d.id = c.document_id
left join vect  on vect.id  = c.id
left join texte on texte.id = c.id
where vect.id is not null or texte.id is not null
order by score desc
limit match_count;
$$;

-- Récupération d'un article précis ("que dit l'article 12 de l'AUSCGIE ?")
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
language sql stable as $$
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

-- =============================================================
-- 4. RLS — lecture publique, écriture réservée au service_role
-- =============================================================
alter table public.legal_documents enable row level security;
alter table public.legal_chunks    enable row level security;

drop policy if exists "lecture publique documents" on public.legal_documents;
create policy "lecture publique documents"
  on public.legal_documents for select
  to anon, authenticated
  using (true);

drop policy if exists "lecture publique chunks" on public.legal_chunks;
create policy "lecture publique chunks"
  on public.legal_chunks for select
  to anon, authenticated
  using (true);

-- Aucune policy d'écriture : seul service_role (qui contourne RLS)
-- peut ingérer. C'est volontaire.

grant execute on function public.search_legal_base to anon, authenticated;
grant execute on function public.get_article       to anon, authenticated;

-- =============================================================
-- 5. Vue de contrôle d'ingestion
-- =============================================================
create or replace view public.v_ingestion_status as
select
  d.categorie,
  d.juridiction,
  count(distinct d.id)                                as documents,
  count(c.id)                                         as chunks,
  count(c.id) filter (where c.embedding is null)      as chunks_sans_embedding,
  count(distinct d.id) filter (where d.ocr)           as documents_ocr
from public.legal_documents d
left join public.legal_chunks c on c.document_id = d.id
group by d.categorie, d.juridiction
order by d.categorie;
