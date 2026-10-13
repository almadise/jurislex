-- =============================================================
-- C1 — relations pilote (domaine travail + OHADA recouvrement)
-- À exécuter APRÈS ingestion des documents concernés.
-- Les INSERT sont no-op si les slugs n'existent pas encore.
-- Confidence = probable (revue juriste requise pour verified).
-- =============================================================

-- Exemple : un texte qui « cites » / « refers_to » un autre par slug
-- Ajuster les slugs selon build/chunks.jsonl / legal_documents.

insert into public.legal_relations (
  from_document_id,
  to_document_id,
  relation_type,
  from_article,
  to_article,
  confidence,
  justification
)
select
  d_from.id,
  d_to.id,
  'refers_to',
  null,
  null,
  'probable',
  'Pilote C1 : lien structurel à valider (travail / OHADA).'
from public.legal_documents d_from
cross join public.legal_documents d_to
where d_from.slug ilike '%92-007%'
  and d_to.slug ilike '%constitution%'
  and d_from.id <> d_to.id
on conflict do nothing;

-- OHADA : AUS / AUPSRVE si présents (noms variables selon extract)
insert into public.legal_relations (
  from_document_id,
  to_document_id,
  relation_type,
  confidence,
  justification
)
select
  d_from.id,
  d_to.id,
  'refers_to',
  'probable',
  'Pilote C1 : recouvrement / procédures OHADA — à valider.'
from public.legal_documents d_from
cross join public.legal_documents d_to
where (
    d_from.slug ilike '%aus%'
    or d_from.titre ilike '%sûretés%'
    or d_from.categorie ilike '%OHADA%'
  )
  and (
    d_to.slug ilike '%aupsrve%'
    or d_to.titre ilike '%procédures simplifiées%'
    or d_to.titre ilike '%recouvrement%'
  )
  and d_from.id <> d_to.id
limit 5
on conflict do nothing;

-- Vérification
select
  r.relation_type,
  r.confidence,
  df.titre as from_titre,
  dt.titre as to_titre
from public.legal_relations r
join public.legal_documents df on df.id = r.from_document_id
join public.legal_documents dt on dt.id = r.to_document_id
order by r.created_at desc
limit 20;
