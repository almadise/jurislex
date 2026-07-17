-- ============================================================
-- Observatoire des mises à jour
-- Comparaison de versions, détection d'articles modifiés,
-- mise en quarantaine des réponses affectées
-- ============================================================

-- 1. TYPES
DROP TYPE IF EXISTS public.text_version_status CASCADE;
CREATE TYPE public.text_version_status AS ENUM ('active', 'superseded', 'archived');

DROP TYPE IF EXISTS public.change_type CASCADE;
CREATE TYPE public.change_type AS ENUM ('addition', 'modification', 'deletion', 'renumbering');

DROP TYPE IF EXISTS public.quarantine_status CASCADE;
CREATE TYPE public.quarantine_status AS ENUM ('quarantined', 'reviewed', 'cleared', 'invalidated');

-- 2. TABLES

-- Textes juridiques ingérés (versions)
CREATE TABLE IF NOT EXISTS public.legal_text_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text_reference TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT 'general',
    version_number INTEGER NOT NULL DEFAULT 1,
    version_label TEXT,
    content_hash TEXT NOT NULL,
    full_text TEXT,
    metadata JSONB DEFAULT '{}',
    version_status public.text_version_status DEFAULT 'active'::public.text_version_status,
    ingested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    effective_date DATE,
    superseded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Articles détectés comme modifiés entre deux versions
CREATE TABLE IF NOT EXISTS public.article_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text_reference TEXT NOT NULL,
    old_version_id UUID REFERENCES public.legal_text_versions(id) ON DELETE CASCADE,
    new_version_id UUID REFERENCES public.legal_text_versions(id) ON DELETE CASCADE,
    article_number TEXT NOT NULL,
    article_title TEXT,
    change_type public.change_type NOT NULL,
    old_content TEXT,
    new_content TEXT,
    diff_summary TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    detected_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    is_confirmed BOOLEAN DEFAULT false,
    confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Réponses mises en quarantaine suite à des modifications
CREATE TABLE IF NOT EXISTS public.quarantined_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_type TEXT NOT NULL DEFAULT 'qa_response' CHECK (response_type IN ('qa_response', 'analysis', 'document', 'search_result')),
    response_reference TEXT,
    original_query TEXT,
    original_response TEXT,
    affected_articles TEXT[] DEFAULT '{}',
    affected_text_references TEXT[] DEFAULT '{}',
    quarantine_reason TEXT,
    quarantine_status public.quarantine_status DEFAULT 'quarantined'::public.quarantine_status,
    quarantined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    quarantined_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    article_change_id UUID REFERENCES public.article_changes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_legal_text_versions_reference ON public.legal_text_versions(text_reference);
CREATE INDEX IF NOT EXISTS idx_legal_text_versions_status ON public.legal_text_versions(version_status);
CREATE INDEX IF NOT EXISTS idx_legal_text_versions_domain ON public.legal_text_versions(domain);
CREATE INDEX IF NOT EXISTS idx_article_changes_reference ON public.article_changes(text_reference);
CREATE INDEX IF NOT EXISTS idx_article_changes_old_version ON public.article_changes(old_version_id);
CREATE INDEX IF NOT EXISTS idx_article_changes_new_version ON public.article_changes(new_version_id);
CREATE INDEX IF NOT EXISTS idx_article_changes_severity ON public.article_changes(severity);
CREATE INDEX IF NOT EXISTS idx_quarantined_responses_status ON public.quarantined_responses(quarantine_status);
CREATE INDEX IF NOT EXISTS idx_quarantined_responses_change ON public.quarantined_responses(article_change_id);

-- 4. FUNCTIONS (before RLS)
CREATE OR REPLACE FUNCTION public.is_reviewer_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('reviseur', 'reviewer', 'admin')
)
$$;

-- 5. ENABLE RLS
ALTER TABLE public.legal_text_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarantined_responses ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- legal_text_versions: tous les authentifiés peuvent lire, réviseurs/admins peuvent écrire
DROP POLICY IF EXISTS "authenticated_read_legal_text_versions" ON public.legal_text_versions;
CREATE POLICY "authenticated_read_legal_text_versions"
ON public.legal_text_versions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "reviewer_admin_manage_legal_text_versions" ON public.legal_text_versions;
CREATE POLICY "reviewer_admin_manage_legal_text_versions"
ON public.legal_text_versions
FOR ALL
TO authenticated
USING (public.is_reviewer_or_admin())
WITH CHECK (public.is_reviewer_or_admin());

-- article_changes: tous les authentifiés peuvent lire, réviseurs/admins peuvent écrire
DROP POLICY IF EXISTS "authenticated_read_article_changes" ON public.article_changes;
CREATE POLICY "authenticated_read_article_changes"
ON public.article_changes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "reviewer_admin_manage_article_changes" ON public.article_changes;
CREATE POLICY "reviewer_admin_manage_article_changes"
ON public.article_changes
FOR ALL
TO authenticated
USING (public.is_reviewer_or_admin())
WITH CHECK (public.is_reviewer_or_admin());

-- quarantined_responses: réviseurs/admins uniquement
DROP POLICY IF EXISTS "reviewer_admin_manage_quarantined_responses" ON public.quarantined_responses;
CREATE POLICY "reviewer_admin_manage_quarantined_responses"
ON public.quarantined_responses
FOR ALL
TO authenticated
USING (public.is_reviewer_or_admin())
WITH CHECK (public.is_reviewer_or_admin());

-- 7. MOCK DATA
DO $$
DECLARE
    existing_user_id UUID;
    v1_id UUID := gen_random_uuid();
    v2_id UUID := gen_random_uuid();
    v3_id UUID := gen_random_uuid();
    v4_id UUID := gen_random_uuid();
    change1_id UUID := gen_random_uuid();
    change2_id UUID := gen_random_uuid();
    change3_id UUID := gen_random_uuid();
BEGIN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

    -- Versions de textes
    INSERT INTO public.legal_text_versions (id, text_reference, title, source, domain, version_number, version_label, content_hash, version_status, ingested_by, effective_date)
    VALUES
        (v1_id, 'OHADA-AU-COMM-2000', 'Acte Uniforme sur le Droit Commercial Général', 'OHADA', 'commercial', 1, 'Version originale 2000', md5('ohada-comm-v1'), 'superseded'::public.text_version_status, existing_user_id, '2000-01-01'),
        (v2_id, 'OHADA-AU-COMM-2000', 'Acte Uniforme sur le Droit Commercial Général', 'OHADA', 'commercial', 2, 'Révision 2010', md5('ohada-comm-v2'), 'superseded'::public.text_version_status, existing_user_id, '2010-12-15'),
        (v3_id, 'OHADA-AU-SOC-2014', 'Acte Uniforme relatif au Droit des Sociétés Commerciales', 'OHADA', 'societes', 1, 'Version 2014', md5('ohada-soc-v1'), 'active'::public.text_version_status, existing_user_id, '2014-05-05'),
        (v4_id, 'CMR-CODE-TRAVAIL-2016', 'Code du Travail du Cameroun', 'République du Cameroun', 'travail', 1, 'Loi n°92/007 révisée 2016', md5('cmr-travail-v1'), 'active'::public.text_version_status, existing_user_id, '2016-07-01')
    ON CONFLICT (id) DO NOTHING;

    -- Articles modifiés
    INSERT INTO public.article_changes (id, text_reference, old_version_id, new_version_id, article_number, article_title, change_type, old_content, new_content, diff_summary, severity, detected_by, is_confirmed)
    VALUES
        (change1_id, 'OHADA-AU-COMM-2000', v1_id, v2_id, 'Art. 234', 'Conditions de validité du contrat commercial', 'modification'::public.change_type,
         'Le contrat commercial est valide dès lors que les parties ont exprimé leur consentement.',
         'Le contrat commercial est valide dès lors que les parties ont exprimé leur consentement libre et éclairé, sans vice du consentement.',
         'Ajout de la condition "libre et éclairé" et de la notion de vice du consentement', 'high', existing_user_id, true),
        (change2_id, 'OHADA-AU-COMM-2000', v1_id, v2_id, 'Art. 67', 'Registre du Commerce', 'modification'::public.change_type,
         'Toute personne physique ou morale ayant la qualité de commerçant doit s''immatriculer au RCCM.',
         'Toute personne physique ou morale ayant la qualité de commerçant doit s''immatriculer au RCCM dans un délai de 30 jours suivant le début de son activité.',
         'Ajout d''un délai d''immatriculation de 30 jours', 'medium', existing_user_id, true),
        (change3_id, 'OHADA-AU-COMM-2000', v1_id, v2_id, 'Art. 189', 'Fonds de commerce', 'addition'::public.change_type,
         NULL,
         'Le fonds de commerce comprend obligatoirement la clientèle et l''achalandage. Il peut comprendre aussi l''enseigne et le nom commercial, les droits de propriété intellectuelle, le mobilier commercial, le matériel et l''outillage, les stocks de marchandises.',
         'Nouvel article définissant la composition du fonds de commerce', 'critical', existing_user_id, false)
    ON CONFLICT (id) DO NOTHING;

    -- Réponses en quarantaine
    INSERT INTO public.quarantined_responses (id, response_type, response_reference, original_query, original_response, affected_articles, affected_text_references, quarantine_reason, quarantine_status, quarantined_by, article_change_id)
    VALUES
        (gen_random_uuid(), 'qa_response', 'QA-2024-0312', 'Quelles sont les conditions de validité d''un contrat commercial OHADA ?',
         'Selon l''article 234 de l''Acte Uniforme OHADA sur le Droit Commercial, le contrat commercial est valide dès lors que les parties ont exprimé leur consentement.',
         ARRAY['Art. 234'], ARRAY['OHADA-AU-COMM-2000'],
         'L''article 234 a été modifié pour inclure la condition de consentement libre et éclairé. La réponse ne reflète plus le texte en vigueur.',
         'quarantined'::public.quarantine_status, existing_user_id, change1_id),
        (gen_random_uuid(), 'analysis', 'ANAL-2024-0287', 'Analyse des obligations d''immatriculation au RCCM',
         'L''immatriculation au RCCM est obligatoire pour tout commerçant sans délai spécifique imposé par la loi.',
         ARRAY['Art. 67'], ARRAY['OHADA-AU-COMM-2000'],
         'L''article 67 impose désormais un délai de 30 jours pour l''immatriculation. L''analyse est obsolète.',
         'reviewed'::public.quarantine_status, existing_user_id, change2_id)
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
