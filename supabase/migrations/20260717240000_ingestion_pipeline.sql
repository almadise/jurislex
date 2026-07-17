-- ============================================================
-- Pipeline d'ingestion admin — JurisLex MVP
-- ============================================================

-- 1. TYPES
DROP TYPE IF EXISTS public.ingestion_job_status CASCADE;
CREATE TYPE public.ingestion_job_status AS ENUM (
  'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
);

DROP TYPE IF EXISTS public.ingestion_step_status CASCADE;
CREATE TYPE public.ingestion_step_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'skipped'
);

DROP TYPE IF EXISTS public.correction_status CASCADE;
CREATE TYPE public.correction_status AS ENUM (
  'pending', 'in_review', 'corrected', 'rejected', 'escalated'
);

DROP TYPE IF EXISTS public.ingestion_source_type CASCADE;
CREATE TYPE public.ingestion_source_type AS ENUM (
  'pdf', 'docx', 'html', 'txt', 'url', 'api'
);

-- 2. TABLES

-- Ingestion jobs (one per document batch)
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  source_type public.ingestion_source_type NOT NULL DEFAULT 'pdf',
  source_path TEXT,
  source_url TEXT,
  domain TEXT NOT NULL DEFAULT 'OHADA',
  jurisdiction TEXT NOT NULL DEFAULT 'Cameroun',
  initiated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  job_status public.ingestion_job_status NOT NULL DEFAULT 'pending',
  total_documents INTEGER NOT NULL DEFAULT 0,
  processed_documents INTEGER NOT NULL DEFAULT 0,
  failed_documents INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13 pipeline steps per job
CREATE TABLE IF NOT EXISTS public.ingestion_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 13),
  step_name TEXT NOT NULL,
  step_key TEXT NOT NULL,
  step_status public.ingestion_step_status NOT NULL DEFAULT 'pending',
  items_total INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_details TEXT,
  output_summary JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Manual correction queue
CREATE TABLE IF NOT EXISTS public.correction_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  document_reference TEXT,
  article_number TEXT,
  original_content TEXT,
  corrected_content TEXT,
  correction_type TEXT NOT NULL DEFAULT 'ocr_error',
  correction_status public.correction_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ingestion reports
CREATE TABLE IF NOT EXISTS public.ingestion_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'full',
  total_documents INTEGER NOT NULL DEFAULT 0,
  successful_documents INTEGER NOT NULL DEFAULT 0,
  failed_documents INTEGER NOT NULL DEFAULT 0,
  total_segments INTEGER NOT NULL DEFAULT 0,
  total_embeddings INTEGER NOT NULL DEFAULT 0,
  total_indexed INTEGER NOT NULL DEFAULT 0,
  corrections_pending INTEGER NOT NULL DEFAULT 0,
  corrections_done INTEGER NOT NULL DEFAULT 0,
  ocr_confidence_avg NUMERIC(5,2),
  sha256_duplicates INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER,
  step_summary JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON public.ingestion_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_initiated_by ON public.ingestion_jobs(initiated_by);
CREATE INDEX IF NOT EXISTS idx_ingestion_steps_job_id ON public.ingestion_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_steps_job_step ON public.ingestion_steps(job_id, step_number);
CREATE INDEX IF NOT EXISTS idx_correction_queue_job_id ON public.correction_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_correction_queue_status ON public.correction_queue(correction_status);
CREATE INDEX IF NOT EXISTS idx_ingestion_reports_job_id ON public.ingestion_reports(job_id);

-- 4. FUNCTIONS

-- Helper: is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 5. RLS
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_reports ENABLE ROW LEVEL SECURITY;

-- ingestion_jobs: admin only
DROP POLICY IF EXISTS "admin_manage_ingestion_jobs" ON public.ingestion_jobs;
CREATE POLICY "admin_manage_ingestion_jobs"
ON public.ingestion_jobs FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ingestion_steps: admin only
DROP POLICY IF EXISTS "admin_manage_ingestion_steps" ON public.ingestion_steps;
CREATE POLICY "admin_manage_ingestion_steps"
ON public.ingestion_steps FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- correction_queue: admin only
DROP POLICY IF EXISTS "admin_manage_correction_queue" ON public.correction_queue;
CREATE POLICY "admin_manage_correction_queue"
ON public.correction_queue FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ingestion_reports: admin only
DROP POLICY IF EXISTS "admin_manage_ingestion_reports" ON public.ingestion_reports;
CREATE POLICY "admin_manage_ingestion_reports"
ON public.ingestion_reports FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. TRIGGERS
DROP TRIGGER IF EXISTS set_ingestion_jobs_updated_at ON public.ingestion_jobs;
CREATE TRIGGER set_ingestion_jobs_updated_at
  BEFORE UPDATE ON public.ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_correction_queue_updated_at ON public.correction_queue;
CREATE TRIGGER set_correction_queue_updated_at
  BEFORE UPDATE ON public.correction_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. MOCK DATA
DO $$
DECLARE
  admin_user_id UUID;
  job1_id UUID := gen_random_uuid();
  job2_id UUID := gen_random_uuid();
  report1_id UUID := gen_random_uuid();
  step_names TEXT[] := ARRAY[
    'Découverte des sources',
    'Vérification SHA-256',
    'Extraction de texte (OCR)',
    'Nettoyage & normalisation',
    'Segmentation en articles',
    'Détection de la structure',
    'Extraction des métadonnées',
    'Génération des embeddings',
    'Indexation vectorielle',
    'Indexation full-text',
    'Validation de cohérence',
    'Mise à jour du registre',
    'Rapport final'
  ];
  step_keys TEXT[] := ARRAY[
    'discovery', 'sha256', 'ocr', 'cleaning', 'segmentation',
    'structure', 'metadata', 'embedding', 'vector_index',
    'fts_index', 'validation', 'registry', 'report'
  ];
  i INTEGER;
BEGIN
  -- Get admin user
  SELECT id INTO admin_user_id FROM public.user_profiles WHERE role = 'admin' LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    -- Job 1: completed
    INSERT INTO public.ingestion_jobs (
      id, title, description, source_type, domain, jurisdiction,
      initiated_by, job_status, total_documents, processed_documents,
      failed_documents, started_at, completed_at, metadata
    ) VALUES (
      job1_id,
      'Acte Uniforme OHADA — Droit Commercial Général',
      'Ingestion complète de l''Acte Uniforme révisé portant sur le droit commercial général (AUDCG 2010)',
      'pdf', 'OHADA', 'Cameroun',
      admin_user_id, 'completed', 42, 42, 0,
      NOW() - INTERVAL '2 hours', NOW() - INTERVAL '30 minutes',
      jsonb_build_object('version', '2010', 'pages', 187, 'language', 'fr')
    ) ON CONFLICT (id) DO NOTHING;

    -- Steps for job 1 (all completed)
    FOR i IN 1..13 LOOP
      INSERT INTO public.ingestion_steps (
        job_id, step_number, step_name, step_key, step_status,
        items_total, items_processed, items_failed, duration_ms,
        started_at, completed_at,
        output_summary
      ) VALUES (
        job1_id, i, step_names[i], step_keys[i], 'completed',
        CASE WHEN i = 1 THEN 42 WHEN i = 3 THEN 42 WHEN i = 5 THEN 312
             WHEN i = 8 THEN 312 WHEN i = 9 THEN 312 ELSE 42 END,
        CASE WHEN i = 1 THEN 42 WHEN i = 3 THEN 42 WHEN i = 5 THEN 312
             WHEN i = 8 THEN 312 WHEN i = 9 THEN 312 ELSE 42 END,
        0,
        CASE WHEN i = 3 THEN 45200 WHEN i = 8 THEN 120300 ELSE 2400 + i * 300 END,
        NOW() - INTERVAL '2 hours' + (i * INTERVAL '8 minutes'),
        NOW() - INTERVAL '2 hours' + (i * INTERVAL '8 minutes') + INTERVAL '7 minutes',
        jsonb_build_object('step', step_keys[i], 'ok', true)
      ) ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- Report for job 1
    INSERT INTO public.ingestion_reports (
      id, job_id, report_type, total_documents, successful_documents,
      failed_documents, total_segments, total_embeddings, total_indexed,
      corrections_pending, corrections_done, ocr_confidence_avg,
      sha256_duplicates, processing_time_ms,
      step_summary
    ) VALUES (
      report1_id, job1_id, 'full', 42, 42, 0, 312, 312, 312,
      3, 0, 97.4, 2, 5400000,
      jsonb_build_array(
        jsonb_build_object('step', 'discovery', 'status', 'completed', 'items', 42),
        jsonb_build_object('step', 'sha256', 'status', 'completed', 'duplicates', 2),
        jsonb_build_object('step', 'ocr', 'status', 'completed', 'confidence', 97.4),
        jsonb_build_object('step', 'segmentation', 'status', 'completed', 'segments', 312),
        jsonb_build_object('step', 'embedding', 'status', 'completed', 'vectors', 312),
        jsonb_build_object('step', 'vector_index', 'status', 'completed', 'indexed', 312)
      )
    ) ON CONFLICT (id) DO NOTHING;

    -- Correction queue items for job 1
    INSERT INTO public.correction_queue (
      job_id, step_key, document_reference, article_number,
      original_content, corrected_content, correction_type,
      correction_status, priority
    ) VALUES
    (job1_id, 'ocr', 'AUDCG-2010', 'Art. 15',
     'Le commercant est tenu de s''inscrire au Registre du Cornmerce',
     'Le commerçant est tenu de s''inscrire au Registre du Commerce',
     'ocr_error', 'pending', 3),
    (job1_id, 'segmentation', 'AUDCG-2010', 'Art. 72',
     'Article 72 — Obligations du vendeur\nLe vendeur doit livrer...',
     NULL, 'segmentation_error', 'pending', 2),
    (job1_id, 'ocr', 'AUDCG-2010', 'Art. 103',
     'L''acheteur peut demander la résolutlon du contrat',
     'L''acheteur peut demander la résolution du contrat',
     'ocr_error', 'in_review', 4)
    ON CONFLICT (id) DO NOTHING;

    -- Job 2: running
    INSERT INTO public.ingestion_jobs (
      id, title, description, source_type, domain, jurisdiction,
      initiated_by, job_status, total_documents, processed_documents,
      failed_documents, started_at, metadata
    ) VALUES (
      job2_id,
      'Code Civil Camerounais — Livre III',
      'Ingestion du Livre III du Code Civil relatif aux différentes manières dont on acquiert la propriété',
      'pdf', 'Droit Civil', 'Cameroun',
      admin_user_id, 'running', 28, 14, 1,
      NOW() - INTERVAL '20 minutes',
      jsonb_build_object('version', '2023', 'pages', 94, 'language', 'fr')
    ) ON CONFLICT (id) DO NOTHING;

    -- Steps for job 2 (partially done)
    FOR i IN 1..13 LOOP
      INSERT INTO public.ingestion_steps (
        job_id, step_number, step_name, step_key, step_status,
        items_total, items_processed, items_failed, duration_ms,
        started_at, completed_at
      ) VALUES (
        job2_id, i, step_names[i], step_keys[i],
        CASE WHEN i <= 6 THEN 'completed' WHEN i = 7 THEN 'running' ELSE 'pending' END,
        CASE WHEN i <= 7 THEN 28 ELSE 0 END,
        CASE WHEN i <= 6 THEN 28 WHEN i = 7 THEN 14 ELSE 0 END,
        CASE WHEN i = 3 THEN 1 ELSE 0 END,
        CASE WHEN i <= 6 THEN 3000 + i * 200 ELSE NULL END,
        CASE WHEN i <= 7 THEN NOW() - INTERVAL '20 minutes' + (i * INTERVAL '2 minutes') ELSE NULL END,
        CASE WHEN i <= 6 THEN NOW() - INTERVAL '20 minutes' + (i * INTERVAL '2 minutes') + INTERVAL '90 seconds' ELSE NULL END
      ) ON CONFLICT (id) DO NOTHING;
    END LOOP;

  ELSE
    RAISE NOTICE 'No admin user found. Run auth migration first.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
