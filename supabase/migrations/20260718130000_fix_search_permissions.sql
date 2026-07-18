-- ============================================================
-- juriLex — Fix: Search RPC permissions (idempotent)
-- Root cause: EXECUTE grants and RLS SELECT policy on legal_provisions
-- were never applied, causing "Search failed" errors for anon role.
-- ============================================================

-- 1. Recreate search functions with SECURITY DEFINER (idempotent)
--    This ensures the function owner has SELECT on legal_provisions
--    and the anon/authenticated roles only need EXECUTE.

CREATE OR REPLACE FUNCTION public.search_provisions_lexical(
  query_text TEXT,
  filter_domain TEXT[] DEFAULT NULL,
  filter_authority TEXT[] DEFAULT NULL,
  filter_legal_status TEXT[] DEFAULT NULL,
  filter_provenance TEXT[] DEFAULT NULL,
  filter_language TEXT[] DEFAULT NULL,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  reference TEXT,
  article TEXT,
  excerpt TEXT,
  page_number INTEGER,
  domain TEXT,
  authority TEXT,
  provision_date TEXT,
  provenance TEXT,
  legal_status TEXT,
  language TEXT,
  match_score FLOAT,
  match_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  BEGIN
    ts_query := plainto_tsquery('french', query_text);
  EXCEPTION WHEN OTHERS THEN
    ts_query := plainto_tsquery('french', regexp_replace(query_text, '[^a-zA-ZÀ-ÿ0-9\s]', ' ', 'g'));
  END;

  RETURN QUERY
  SELECT
    lp.id,
    lp.title,
    lp.reference,
    lp.article,
    lp.excerpt,
    lp.page_number,
    lp.domain,
    lp.authority,
    lp.provision_date,
    lp.provenance,
    lp.legal_status,
    lp.language,
    (ts_rank_cd(lp.fts_vector, ts_query) * 100.0)::FLOAT AS match_score,
    'Correspondance lexicale'::TEXT AS match_reason
  FROM public.legal_provisions lp
  WHERE
    lp.fts_vector @@ ts_query
    AND (filter_domain IS NULL OR lp.domain = ANY(filter_domain))
    AND (filter_authority IS NULL OR lp.authority = ANY(filter_authority))
    AND (filter_legal_status IS NULL OR lp.legal_status = ANY(filter_legal_status))
    AND (filter_provenance IS NULL OR lp.provenance = ANY(filter_provenance))
    AND (filter_language IS NULL OR lp.language = ANY(filter_language))
  ORDER BY match_score DESC
  LIMIT result_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_provisions_exact(
  query_text TEXT,
  filter_domain TEXT[] DEFAULT NULL,
  filter_authority TEXT[] DEFAULT NULL,
  filter_legal_status TEXT[] DEFAULT NULL,
  filter_provenance TEXT[] DEFAULT NULL,
  filter_language TEXT[] DEFAULT NULL,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  reference TEXT,
  article TEXT,
  excerpt TEXT,
  page_number INTEGER,
  domain TEXT,
  authority TEXT,
  provision_date TEXT,
  provenance TEXT,
  legal_status TEXT,
  language TEXT,
  match_score FLOAT,
  match_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lp.id,
    lp.title,
    lp.reference,
    lp.article,
    lp.excerpt,
    lp.page_number,
    lp.domain,
    lp.authority,
    lp.provision_date,
    lp.provenance,
    lp.legal_status,
    lp.language,
    CASE
      WHEN lower(lp.reference) = lower(query_text) THEN 100.0
      WHEN lower(lp.reference) LIKE lower('%' || query_text || '%') THEN 95.0
      WHEN lower(lp.article) LIKE lower('%' || query_text || '%') THEN 90.0
      WHEN lower(lp.title) LIKE lower('%' || query_text || '%') THEN 80.0
      ELSE 70.0
    END::FLOAT AS match_score,
    'Référence exacte'::TEXT AS match_reason
  FROM public.legal_provisions lp
  WHERE
    (
      lower(lp.reference) LIKE lower('%' || query_text || '%')
      OR lower(lp.article) LIKE lower('%' || query_text || '%')
      OR lower(lp.title) LIKE lower('%' || query_text || '%')
    )
    AND (filter_domain IS NULL OR lp.domain = ANY(filter_domain))
    AND (filter_authority IS NULL OR lp.authority = ANY(filter_authority))
    AND (filter_legal_status IS NULL OR lp.legal_status = ANY(filter_legal_status))
    AND (filter_provenance IS NULL OR lp.provenance = ANY(filter_provenance))
    AND (filter_language IS NULL OR lp.language = ANY(filter_language))
  ORDER BY match_score DESC
  LIMIT result_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_provisions_semantic(
  query_embedding vector(1536),
  filter_domain TEXT[] DEFAULT NULL,
  filter_authority TEXT[] DEFAULT NULL,
  filter_legal_status TEXT[] DEFAULT NULL,
  filter_provenance TEXT[] DEFAULT NULL,
  filter_language TEXT[] DEFAULT NULL,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  reference TEXT,
  article TEXT,
  excerpt TEXT,
  page_number INTEGER,
  domain TEXT,
  authority TEXT,
  provision_date TEXT,
  provenance TEXT,
  legal_status TEXT,
  language TEXT,
  match_score FLOAT,
  match_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lp.id,
    lp.title,
    lp.reference,
    lp.article,
    lp.excerpt,
    lp.page_number,
    lp.domain,
    lp.authority,
    lp.provision_date,
    lp.provenance,
    lp.legal_status,
    lp.language,
    ((1 - (lp.embedding <=> query_embedding)) * 100.0)::FLOAT AS match_score,
    'Similarité sémantique'::TEXT AS match_reason
  FROM public.legal_provisions lp
  WHERE
    lp.embedding IS NOT NULL
    AND (filter_domain IS NULL OR lp.domain = ANY(filter_domain))
    AND (filter_authority IS NULL OR lp.authority = ANY(filter_authority))
    AND (filter_legal_status IS NULL OR lp.legal_status = ANY(filter_legal_status))
    AND (filter_provenance IS NULL OR lp.provenance = ANY(filter_provenance))
    AND (filter_language IS NULL OR lp.language = ANY(filter_language))
  ORDER BY lp.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$;

-- 2. Grant EXECUTE to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.search_provisions_exact(
  TEXT, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], INTEGER
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_provisions_lexical(
  TEXT, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], INTEGER
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_provisions_semantic(
  vector, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], INTEGER
) TO anon, authenticated;

-- 3. Ensure RLS is enabled and add public SELECT policy
ALTER TABLE public.legal_provisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_legal_provisions" ON public.legal_provisions;
CREATE POLICY "public_read_legal_provisions"
ON public.legal_provisions
FOR SELECT
TO anon, authenticated
USING (true);
