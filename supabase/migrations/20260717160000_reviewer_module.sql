-- ─── Reviewer Module Migration ────────────────────────────────────────────────
-- Tables: review_items, review_annotations, review_corrections
-- RLS: réviseur role can read/write all; owners can read their own items

-- 1. Types
DROP TYPE IF EXISTS public.review_item_type CASCADE;
CREATE TYPE public.review_item_type AS ENUM ('qa_response', 'analysis', 'document');

DROP TYPE IF EXISTS public.review_status CASCADE;
CREATE TYPE public.review_status AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'published');

DROP TYPE IF EXISTS public.annotation_type CASCADE;
CREATE TYPE public.annotation_type AS ENUM ('comment', 'correction', 'citation_error', 'qualification_error', 'validation');

-- 2. Tables

-- Review queue: items submitted for review
CREATE TABLE IF NOT EXISTS public.review_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitter_id    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  item_type       public.review_item_type NOT NULL DEFAULT 'qa_response',
  review_status   public.review_status NOT NULL DEFAULT 'pending',
  title           TEXT NOT NULL DEFAULT '',
  original_content JSONB NOT NULL DEFAULT '{}',
  corrected_content JSONB,
  domain          TEXT NOT NULL DEFAULT '',
  priority        TEXT NOT NULL DEFAULT 'normal',
  submitted_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reviewed_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Annotations on review items
CREATE TABLE IF NOT EXISTS public.review_annotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_item_id  UUID NOT NULL REFERENCES public.review_items(id) ON DELETE CASCADE,
  reviewer_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  annotation_type public.annotation_type NOT NULL DEFAULT 'comment',
  target_field    TEXT NOT NULL DEFAULT '',
  original_text   TEXT NOT NULL DEFAULT '',
  corrected_text  TEXT,
  comment         TEXT NOT NULL DEFAULT '',
  citation_ref    TEXT,
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Published corrections reusable across the system
CREATE TABLE IF NOT EXISTS public.review_corrections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  review_item_id  UUID REFERENCES public.review_items(id) ON DELETE SET NULL,
  domain          TEXT NOT NULL DEFAULT '',
  error_pattern   TEXT NOT NULL DEFAULT '',
  correction_rule TEXT NOT NULL DEFAULT '',
  citation_ref    TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_review_items_status ON public.review_items(review_status);
CREATE INDEX IF NOT EXISTS idx_review_items_reviewer ON public.review_items(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_items_submitter ON public.review_items(submitter_id);
CREATE INDEX IF NOT EXISTS idx_review_items_type ON public.review_items(item_type);
CREATE INDEX IF NOT EXISTS idx_review_annotations_item ON public.review_annotations(review_item_id);
CREATE INDEX IF NOT EXISTS idx_review_annotations_reviewer ON public.review_annotations(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_corrections_reviewer ON public.review_corrections(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_corrections_domain ON public.review_corrections(domain);

-- 4. Helper function: check if current user has réviseur or admin role
CREATE OR REPLACE FUNCTION public.is_reviewer_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('reviseur', 'admin', 'reviewer')
  )
$$;

-- 5. Enable RLS
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_corrections ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- review_items: réviseurs can see all; submitters can see their own
DROP POLICY IF EXISTS "reviewers_manage_review_items" ON public.review_items;
CREATE POLICY "reviewers_manage_review_items"
ON public.review_items
FOR ALL
TO authenticated
USING (public.is_reviewer_or_admin() OR submitter_id = auth.uid())
WITH CHECK (public.is_reviewer_or_admin() OR submitter_id = auth.uid());

-- review_annotations: réviseurs can manage all
DROP POLICY IF EXISTS "reviewers_manage_annotations" ON public.review_annotations;
CREATE POLICY "reviewers_manage_annotations"
ON public.review_annotations
FOR ALL
TO authenticated
USING (public.is_reviewer_or_admin() OR reviewer_id = auth.uid())
WITH CHECK (public.is_reviewer_or_admin() OR reviewer_id = auth.uid());

-- review_corrections: réviseurs can manage; all authenticated can read published
DROP POLICY IF EXISTS "reviewers_manage_corrections" ON public.review_corrections;
CREATE POLICY "reviewers_manage_corrections"
ON public.review_corrections
FOR ALL
TO authenticated
USING (public.is_reviewer_or_admin() OR reviewer_id = auth.uid())
WITH CHECK (public.is_reviewer_or_admin() OR reviewer_id = auth.uid());

DROP POLICY IF EXISTS "all_read_published_corrections" ON public.review_corrections;
CREATE POLICY "all_read_published_corrections"
ON public.review_corrections
FOR SELECT
TO authenticated
USING (is_published = true);

-- 7. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_review_items_updated_at ON public.review_items;
CREATE TRIGGER set_review_items_updated_at
  BEFORE UPDATE ON public.review_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_review_annotations_updated_at ON public.review_annotations;
CREATE TRIGGER set_review_annotations_updated_at
  BEFORE UPDATE ON public.review_annotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_review_corrections_updated_at ON public.review_corrections;
CREATE TRIGGER set_review_corrections_updated_at
  BEFORE UPDATE ON public.review_corrections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Mock data
DO $$
DECLARE
  existing_user_id UUID;
  item1_id UUID := gen_random_uuid();
  item2_id UUID := gen_random_uuid();
  item3_id UUID := gen_random_uuid();
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

    IF existing_user_id IS NOT NULL THEN

      INSERT INTO public.review_items (id, reviewer_id, submitter_id, item_type, review_status, title, original_content, domain, priority)
      VALUES
        (item1_id, existing_user_id, existing_user_id, 'qa_response', 'pending',
         'Délai de prescription — action en paiement OHADA',
         jsonb_build_object(
           'question', 'Quel est le délai de prescription pour une action en paiement de créance commerciale selon l''OHADA ?',
           'summary', 'Le délai de prescription pour les créances commerciales est de 5 ans selon l''Acte uniforme OHADA.',
           'legalRule', 'Art. 18 AUDCG — prescription quinquennale',
           'citations', jsonb_build_array(
             jsonb_build_object('reference', 'OHADA-AUDCG-2010', 'article', 'Art. 18', 'legalStatus', 'verified')
           )
         ),
         'Droit commercial OHADA', 'high'),
        (item2_id, existing_user_id, existing_user_id, 'analysis', 'in_review',
         'Analyse — Licenciement économique collectif',
         jsonb_build_object(
           'situation', 'Licenciement de 12 salariés pour motif économique dans une PME de 45 employés.',
           'applicableLaw', 'Code du Travail camerounais, Art. 40 et suivants',
           'risks', jsonb_build_array('Absence de plan social', 'Délai de préavis insuffisant')
         ),
         'Droit du travail', 'normal'),
        (item3_id, existing_user_id, existing_user_id, 'document', 'approved',
         'Mise en demeure — Impayés loyers commerciaux',
         jsonb_build_object(
           'template', 'mise_en_demeure',
           'content', 'Nous vous mettons en demeure de régler la somme de 2 500 000 FCFA...',
           'citations', jsonb_build_array(
             jsonb_build_object('reference', 'CC-CMR-1981', 'article', 'Art. 1139', 'legalStatus', 'verified')
           )
         ),
         'Droit civil', 'low')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.review_annotations (review_item_id, reviewer_id, annotation_type, target_field, original_text, corrected_text, comment, citation_ref)
      VALUES
        (item1_id, existing_user_id, 'citation_error', 'citations[0].article',
         'Art. 18 AUDCG', 'Art. 18 al. 1 AUDCG',
         'L''alinéa 1 doit être précisé pour distinguer des créances non commerciales.',
         'OHADA-AUDCG-2010'),
        (item2_id, existing_user_id, 'qualification_error', 'applicableLaw',
         'Art. 40 et suivants', 'Art. 40 à 52 — procédure de licenciement collectif',
         'La référence doit couvrir l''ensemble de la procédure collective, pas seulement l''article 40.',
         'LOI-92-007-1992')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.review_corrections (reviewer_id, review_item_id, domain, error_pattern, correction_rule, citation_ref, is_published)
      VALUES
        (existing_user_id, item1_id,
         'Droit commercial OHADA',
         'Référence à l''Art. 18 AUDCG sans précision d''alinéa',
         'Toujours préciser l''alinéa applicable lorsque l''article comporte plusieurs alinéas aux effets distincts.',
         'OHADA-AUDCG-2010', true)
      ON CONFLICT (id) DO NOTHING;

    ELSE
      RAISE NOTICE 'No users found. Skipping reviewer mock data.';
    END IF;
  ELSE
    RAISE NOTICE 'Table user_profiles does not exist. Skipping reviewer mock data.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Reviewer mock data failed: %', SQLERRM;
END $$;
