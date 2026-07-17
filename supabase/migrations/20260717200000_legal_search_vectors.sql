-- ============================================================
-- JurisLex — Legal Search Module
-- Tables: legal_provisions
-- Features: pgvector embeddings, full-text search, hybrid search
-- ============================================================

-- 1. ENABLE PGVECTOR EXTENSION (pre-installed in Supabase)
-- Note: vector extension is available in Supabase managed environments
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. LEGAL PROVISIONS TABLE
CREATE TABLE IF NOT EXISTS public.legal_provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  reference TEXT NOT NULL,
  article TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  full_text TEXT NOT NULL DEFAULT '',
  page_number INTEGER DEFAULT 0,
  domain TEXT NOT NULL DEFAULT '',
  authority TEXT NOT NULL DEFAULT '',
  provision_date TEXT NOT NULL DEFAULT '',
  provenance TEXT NOT NULL DEFAULT 'official' CHECK (provenance IN ('official', 'secondary')),
  legal_status TEXT NOT NULL DEFAULT 'unknown' CHECK (legal_status IN ('verified', 'probable', 'unknown', 'repealed', 'superseded')),
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
  embedding vector(1536),
  fts_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('french',
      coalesce(title, '') || ' ' ||
      coalesce(reference, '') || ' ' ||
      coalesce(article, '') || ' ' ||
      coalesce(excerpt, '') || ' ' ||
      coalesce(full_text, '') || ' ' ||
      coalesce(domain, '') || ' ' ||
      coalesce(authority, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_legal_provisions_fts ON public.legal_provisions USING GIN(fts_vector);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_reference ON public.legal_provisions(reference);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_domain ON public.legal_provisions(domain);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_authority ON public.legal_provisions(authority);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_legal_status ON public.legal_provisions(legal_status);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_language ON public.legal_provisions(language);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_provenance ON public.legal_provisions(provenance);

-- Vector index (HNSW for fast approximate nearest-neighbor search)
CREATE INDEX IF NOT EXISTS idx_legal_provisions_embedding ON public.legal_provisions
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. FULL-TEXT SEARCH FUNCTION
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
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  -- Build tsquery from input (handle multi-word queries gracefully)
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

-- 5. EXACT REFERENCE SEARCH FUNCTION
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

-- 6. VECTOR SIMILARITY SEARCH FUNCTION
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

-- 7. RLS
ALTER TABLE public.legal_provisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_legal_provisions" ON public.legal_provisions;
CREATE POLICY "authenticated_read_legal_provisions"
ON public.legal_provisions
FOR SELECT
TO authenticated
USING (true);

-- 8. SEED DATA (representative provisions from Cameroon/OHADA corpus)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_provisions LIMIT 1) THEN
    INSERT INTO public.legal_provisions (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language) VALUES
    (
      'Acte Uniforme relatif au droit commercial général',
      'OHADA-AUDCG-2010',
      'Art. 59',
      'Tout commerçant doit tenir une comptabilité conformément aux dispositions de l''Acte uniforme portant organisation et harmonisation des comptabilités des entreprises.',
      'Tout commerçant doit tenir une comptabilité conformément aux dispositions de l''Acte uniforme portant organisation et harmonisation des comptabilités des entreprises. Il doit tenir à jour un registre des opérations commerciales et se conformer aux obligations comptables prévues par les textes applicables. Tout manquement à ces obligations est susceptible d''engager la responsabilité du commerçant.',
      34, 'Droit commercial OHADA', 'OHADA', '15/12/2010', 'official', 'verified', 'fr'
    ),
    (
      'Code du Travail du Cameroun',
      'LOI-92-007-1992',
      'Art. 66',
      'Le contrat de travail est soumis aux règles du droit commun. Il peut être établi selon les formes que les parties contractantes décident d''adopter.',
      'Le contrat de travail est soumis aux règles du droit commun. Il peut être établi selon les formes que les parties contractantes décident d''adopter. Le contrat de travail à durée indéterminée peut toujours cesser par la volonté de l''une des parties sous réserve des dispositions relatives au préavis et aux indemnités de licenciement.',
      22, 'Droit du travail', 'République du Cameroun', '14/08/1992', 'official', 'verified', 'fr'
    ),
    (
      'Acte Uniforme portant organisation des procédures simplifiées de recouvrement',
      'OHADA-AUPSRVE-1998',
      'Art. 2',
      'Toute créance certaine, liquide et exigible peut faire l''objet d''une procédure d''injonction de payer. La demande est présentée par requête au président de la juridiction compétente.',
      'Toute créance certaine, liquide et exigible peut faire l''objet d''une procédure d''injonction de payer. La demande est présentée par requête au président de la juridiction compétente du domicile ou du siège social du débiteur. La requête doit contenir les mentions prescrites à peine de nullité.',
      3, 'Droit commercial OHADA', 'OHADA', '10/04/1998', 'official', 'verified', 'fr'
    ),
    (
      'Acte Uniforme relatif au droit des sociétés commerciales',
      'OHADA-AUSC-2014',
      'Art. 853-1',
      'La société par actions simplifiée est une société dans laquelle les associés fixent librement, dans les statuts, les conditions et les formes dans lesquelles la société est dirigée.',
      'La société par actions simplifiée est une société dans laquelle les associés fixent librement, dans les statuts, les conditions et les formes dans lesquelles la société est dirigée. Les statuts déterminent les décisions qui doivent être prises collectivement par les associés dans les formes et conditions qu''ils prévoient.',
      187, 'Droit des sociétés', 'OHADA', '30/01/2014', 'official', 'verified', 'fr'
    ),
    (
      'Code Civil camerounais — Livre III',
      'CC-CMR-1981',
      'Art. 1134',
      'Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites. Elles ne peuvent être révoquées que de leur consentement mutuel.',
      'Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites. Elles ne peuvent être révoquées que de leur consentement mutuel, ou pour les causes que la loi autorise. Elles doivent être exécutées de bonne foi.',
      312, 'Droit civil', 'République du Cameroun', '01/01/1981', 'secondary', 'probable', 'fr'
    ),
    (
      'Décret n° 2018/366 portant organisation du Ministère du Travail',
      'DECRET-2018-366',
      'Art. 12',
      'L''Inspection du travail est chargée de veiller à l''application des dispositions légales et réglementaires relatives au travail, à la main-d''œuvre et à la prévoyance sociale.',
      'L''Inspection du travail est chargée de veiller à l''application des dispositions légales et réglementaires relatives au travail, à la main-d''œuvre et à la prévoyance sociale. Elle procède à des contrôles réguliers dans les entreprises et peut dresser des procès-verbaux d''infraction.',
      7, 'Droit du travail', 'République du Cameroun', '20/06/2018', 'official', 'verified', 'fr'
    ),
    (
      'Acte Uniforme portant organisation des sûretés',
      'OHADA-AUS-2010',
      'Art. 4',
      'Les sûretés sont constituées dans l''intérêt d''un créancier pour garantir l''exécution d''une obligation. Elles peuvent être personnelles ou réelles.',
      'Les sûretés sont constituées dans l''intérêt d''un créancier pour garantir l''exécution d''une obligation. Elles peuvent être personnelles ou réelles. Les sûretés personnelles consistent dans l''engagement d''une personne de répondre de l''obligation du débiteur principal en cas de défaillance de celui-ci.',
      4, 'Droit commercial OHADA', 'OHADA', '15/12/2010', 'official', 'verified', 'fr'
    ),
    (
      'Loi n° 2003-008 relative à la répression des infractions',
      'LOI-2003-008',
      'Art. 3',
      'Toute personne qui, par quelque moyen que ce soit, contrefait ou falsifie un acte juridique ou un document officiel est punie d''un emprisonnement de deux à cinq ans.',
      'Toute personne qui, par quelque moyen que ce soit, contrefait ou falsifie un acte juridique ou un document officiel est punie d''un emprisonnement de deux à cinq ans et d''une amende de 200 000 à 2 000 000 de francs CFA ou de l''une de ces deux peines seulement.',
      2, 'Droit pénal', 'République du Cameroun', '10/07/2003', 'secondary', 'unknown', 'fr'
    ),
    (
      'Règlement COBAC R-2001/07 relatif au contrôle interne',
      'COBAC-R-2001-07',
      'Art. 8',
      'Les établissements assujettis doivent se doter d''un système de contrôle interne permettant notamment de vérifier que les opérations réalisées respectent les procédures internes.',
      'Les établissements assujettis doivent se doter d''un système de contrôle interne permettant notamment de vérifier que les opérations réalisées respectent les procédures internes et les dispositions légales et réglementaires en vigueur. Ce système doit être adapté à la nature et au volume des activités de l''établissement.',
      5, 'Droit bancaire COBAC', 'COBAC', '01/01/2002', 'official', 'probable', 'fr'
    ),
    (
      'Ordonnance n° 74-1 du 6 juillet 1974 fixant le régime foncier',
      'ORD-74-1-1974',
      'Art. 1',
      'Les terres du territoire national constituent la propriété publique ou privée de l''État, des collectivités publiques ou des particuliers selon les distinctions établies par la présente ordonnance.',
      'Les terres du territoire national constituent la propriété publique ou privée de l''État, des collectivités publiques ou des particuliers selon les distinctions établies par la présente ordonnance. Le régime foncier est régi par les dispositions de la présente ordonnance et des textes pris pour son application.',
      1, 'Droit foncier', 'République du Cameroun', '06/07/1974', 'secondary', 'superseded', 'fr'
    ),
    (
      'Loi n° 2010/021 régissant le commerce électronique',
      'LOI-2010-021',
      'Art. 22',
      'Le prestataire de services de certification électronique est responsable du préjudice causé aux personnes qui se sont fiées raisonnablement aux certificats qu''il délivre.',
      'Le prestataire de services de certification électronique est responsable du préjudice causé aux personnes qui se sont fiées raisonnablement aux certificats qu''il délivre, à moins qu''il ne prouve qu''il n''a commis aucune faute intentionnelle ou négligente.',
      15, 'Droit numérique', 'République du Cameroun', '21/12/2010', 'official', 'verified', 'fr'
    ),
    (
      'Acte Uniforme relatif au droit de l''arbitrage',
      'OHADA-AUA-2017',
      'Art. 10',
      'Le tribunal arbitral est seul compétent pour statuer sur les contestations relatives à son existence ou à sa validité.',
      'Le tribunal arbitral est seul compétent pour statuer sur les contestations relatives à son existence ou à sa validité. A cet effet, il peut statuer sur sa propre compétence, y compris sur toute exception d''inexistence ou de nullité de la convention d''arbitrage.',
      8, 'Droit commercial OHADA', 'OHADA', '23/11/2017', 'official', 'verified', 'fr'
    ),
    (
      'Code Pénal camerounais',
      'CP-CMR-2016',
      'Art. 318',
      'Est puni d''un emprisonnement de six mois à cinq ans et d''une amende de 100 000 à 1 000 000 de francs CFA, quiconque détourne des fonds publics.',
      'Est puni d''un emprisonnement de six mois à cinq ans et d''une amende de 100 000 à 1 000 000 de francs CFA, quiconque, ayant la garde ou l''administration de fonds publics ou privés, en détourne tout ou partie au préjudice de l''État ou d''un particulier.',
      145, 'Droit pénal', 'République du Cameroun', '12/07/2016', 'official', 'verified', 'fr'
    ),
    (
      'Acte Uniforme relatif au droit des sociétés coopératives',
      'OHADA-AUSCOOP-2010',
      'Art. 5',
      'La société coopérative est une personne morale librement formée par des personnes qui décident de mettre en commun leurs ressources pour satisfaire leurs besoins.',
      'La société coopérative est une personne morale librement formée par des personnes qui décident de mettre en commun leurs ressources pour satisfaire leurs besoins économiques, sociaux ou culturels et dont la gestion est démocratique. Elle est régie par les dispositions du présent Acte uniforme.',
      3, 'Droit des sociétés', 'OHADA', '15/12/2010', 'official', 'verified', 'fr'
    ),
    (
      'Loi n° 99-016 portant statut général des établissements publics',
      'LOI-99-016-1999',
      'Art. 3',
      'Les établissements publics sont des personnes morales de droit public créées par l''État pour assurer la gestion d''un service public.',
      'Les établissements publics sont des personnes morales de droit public créées par l''État pour assurer la gestion d''un service public ou la réalisation d''une mission d''intérêt général. Ils jouissent de l''autonomie administrative et financière.',
      2, 'Droit administratif', 'République du Cameroun', '22/12/1999', 'official', 'verified', 'fr'
    );
  END IF;
END $$;
