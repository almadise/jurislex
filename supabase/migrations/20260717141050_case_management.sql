-- ============================================================
-- JurisLex — Case Management Module
-- Tables: user_profiles, cases, case_analyses, case_documents
-- ============================================================

-- 1. TYPES
DROP TYPE IF EXISTS public.matter_status CASCADE;
CREATE TYPE public.matter_status AS ENUM ('draft', 'active', 'analysis', 'documented', 'closed', 'archived');

DROP TYPE IF EXISTS public.risk_level CASCADE;
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');

DROP TYPE IF EXISTS public.evidence_status CASCADE;
CREATE TYPE public.evidence_status AS ENUM ('available', 'to_gather', 'missing');

DROP TYPE IF EXISTS public.timeline_event_type CASCADE;
CREATE TYPE public.timeline_event_type AS ENUM ('analysis', 'document', 'search', 'qa', 'create', 'update', 'note');

-- 2. CORE TABLES

-- User profiles (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT 'lawyer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Cases (dossiers)
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  parties TEXT[] NOT NULL DEFAULT '{}',
  matter_status public.matter_status NOT NULL DEFAULT 'draft',
  risk_level public.risk_level NOT NULL DEFAULT 'low',
  tags TEXT[] DEFAULT '{}',
  assigned_to TEXT DEFAULT '',
  analyses_count INTEGER NOT NULL DEFAULT 0,
  documents_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Case analyses
CREATE TABLE IF NOT EXISTS public.case_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  confidence_score INTEGER DEFAULT 0,
  risk_level public.risk_level DEFAULT 'low',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Case documents
CREATE TABLE IF NOT EXISTS public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT DEFAULT 'docx',
  file_size TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Case timeline events
CREATE TABLE IF NOT EXISTS public.case_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  event_type public.timeline_event_type NOT NULL DEFAULT 'note',
  label TEXT NOT NULL,
  user_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Case parties detail
CREATE TABLE IF NOT EXISTS public.case_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quality TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Case evidence
CREATE TABLE IF NOT EXISTS public.case_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  evidence_status public.evidence_status NOT NULL DEFAULT 'to_gather',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_id ON public.cases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_matter_status ON public.cases(matter_status);
CREATE INDEX IF NOT EXISTS idx_cases_last_activity ON public.cases(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_analyses_case_id ON public.case_analyses(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON public.case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_timeline_case_id ON public.case_timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON public.case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_evidence_case_id ON public.case_evidence(case_id);

-- 4. FUNCTIONS (must be before RLS policies)

-- Auto-create user_profiles on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'lawyer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Auto-update last_activity_at on case when analyses/documents change
CREATE OR REPLACE FUNCTION public.update_case_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cases
    SET last_activity_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.case_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cases
    SET last_activity_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.case_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recalculate analyses_count on cases
CREATE OR REPLACE FUNCTION public.sync_analyses_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cases SET analyses_count = analyses_count + 1 WHERE id = NEW.case_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cases SET analyses_count = GREATEST(analyses_count - 1, 0) WHERE id = OLD.case_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recalculate documents_count on cases
CREATE OR REPLACE FUNCTION public.sync_documents_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cases SET documents_count = documents_count + 1 WHERE id = NEW.case_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cases SET documents_count = GREATEST(documents_count - 1, 0) WHERE id = OLD.case_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. ENABLE RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_evidence ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- user_profiles: each user manages their own profile
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- cases: each lawyer sees only their own cases
DROP POLICY IF EXISTS "lawyers_manage_own_cases" ON public.cases;
CREATE POLICY "lawyers_manage_own_cases"
ON public.cases
FOR ALL
TO authenticated
USING (lawyer_id = auth.uid())
WITH CHECK (lawyer_id = auth.uid());

-- case_analyses: lawyer owns via lawyer_id
DROP POLICY IF EXISTS "lawyers_manage_own_case_analyses" ON public.case_analyses;
CREATE POLICY "lawyers_manage_own_case_analyses"
ON public.case_analyses
FOR ALL
TO authenticated
USING (lawyer_id = auth.uid())
WITH CHECK (lawyer_id = auth.uid());

-- case_documents: lawyer owns via lawyer_id
DROP POLICY IF EXISTS "lawyers_manage_own_case_documents" ON public.case_documents;
CREATE POLICY "lawyers_manage_own_case_documents"
ON public.case_documents
FOR ALL
TO authenticated
USING (lawyer_id = auth.uid())
WITH CHECK (lawyer_id = auth.uid());

-- case_timeline_events: lawyer owns via lawyer_id
DROP POLICY IF EXISTS "lawyers_manage_own_case_timeline_events" ON public.case_timeline_events;
CREATE POLICY "lawyers_manage_own_case_timeline_events"
ON public.case_timeline_events
FOR ALL
TO authenticated
USING (lawyer_id = auth.uid())
WITH CHECK (lawyer_id = auth.uid());

-- case_parties: access via case ownership
DROP POLICY IF EXISTS "lawyers_manage_own_case_parties" ON public.case_parties;
CREATE POLICY "lawyers_manage_own_case_parties"
ON public.case_parties
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_id AND c.lawyer_id = auth.uid()
  )
);

-- case_evidence: access via case ownership
DROP POLICY IF EXISTS "lawyers_manage_own_case_evidence" ON public.case_evidence;
CREATE POLICY "lawyers_manage_own_case_evidence"
ON public.case_evidence
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_id AND c.lawyer_id = auth.uid()
  )
);

-- 7. TRIGGERS

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS cases_updated_at ON public.cases;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS case_analyses_updated_at ON public.case_analyses;
CREATE TRIGGER case_analyses_updated_at
  BEFORE UPDATE ON public.case_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_analysis_insert ON public.case_analyses;
CREATE TRIGGER on_analysis_insert
  AFTER INSERT ON public.case_analyses
  FOR EACH ROW EXECUTE FUNCTION public.sync_analyses_count();

DROP TRIGGER IF EXISTS on_analysis_delete ON public.case_analyses;
CREATE TRIGGER on_analysis_delete
  AFTER DELETE ON public.case_analyses
  FOR EACH ROW EXECUTE FUNCTION public.sync_analyses_count();

DROP TRIGGER IF EXISTS on_document_insert ON public.case_documents;
CREATE TRIGGER on_document_insert
  AFTER INSERT ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.sync_documents_count();

DROP TRIGGER IF EXISTS on_document_delete ON public.case_documents;
CREATE TRIGGER on_document_delete
  AFTER DELETE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.sync_documents_count();

DROP TRIGGER IF EXISTS on_analysis_activity ON public.case_analyses;
CREATE TRIGGER on_analysis_activity
  AFTER INSERT OR DELETE ON public.case_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_case_activity();

DROP TRIGGER IF EXISTS on_document_activity ON public.case_documents;
CREATE TRIGGER on_document_activity
  AFTER INSERT OR DELETE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_case_activity();

-- 8. MOCK DATA
DO $$
DECLARE
  lawyer_uuid UUID := gen_random_uuid();
  case1_uuid UUID := gen_random_uuid();
  case2_uuid UUID := gen_random_uuid();
  case3_uuid UUID := gen_random_uuid();
  case4_uuid UUID := gen_random_uuid();
  case5_uuid UUID := gen_random_uuid();
BEGIN
  -- Create demo lawyer auth user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    lawyer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'fotso.mbarga@juriscm.cm', crypt('JurisLex2026!', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Fotso Mbarga', 'role', 'lawyer'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  ) ON CONFLICT (id) DO NOTHING;

  -- user_profiles row created by trigger; ensure it exists
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (lawyer_uuid, 'fotso.mbarga@juriscm.cm', 'Fotso Mbarga', 'lawyer')
  ON CONFLICT (id) DO NOTHING;

  -- Cases
  INSERT INTO public.cases (id, lawyer_id, reference, title, domain, parties, matter_status, risk_level, tags, assigned_to, analyses_count, documents_count, last_activity_at, created_at)
  VALUES
    (case1_uuid, lawyer_uuid, 'DOS-2026-0142', 'Licenciement abusif — Nkeng Abanda c/ SARL Fotso & Associés',
     'Droit du travail', ARRAY['Mme Nkeng Abanda', 'SARL Fotso & Associés'],
     'analysis', 'medium', ARRAY['licenciement', 'indemnités', 'urgent'],
     'Fotso Mbarga', 3, 1, now() - interval '1 day', now() - interval '15 days'),
    (case2_uuid, lawyer_uuid, 'DOS-2026-0138', 'Recouvrement de créance — SARL Tchouaffe Import c/ Ets Biya Négoce',
     'Droit commercial OHADA', ARRAY['SARL Tchouaffe Import', 'Ets Biya Négoce'],
     'documented', 'low', ARRAY['recouvrement', 'injonction de payer', 'OHADA'],
     'Fotso Mbarga', 5, 3, now() - interval '3 days', now() - interval '29 days'),
    (case3_uuid, lawyer_uuid, 'DOS-2026-0131', 'Cession de parts sociales — SARL Abanda & Fils',
     'Droit des sociétés', ARRAY['M. Abanda Jean-Pierre', 'Mme Abanda Christelle'],
     'active', 'low', ARRAY['cession', 'sociétés', 'OHADA'],
     'Fotso Mbarga', 2, 2, now() - interval '5 days', now() - interval '42 days'),
    (case4_uuid, lawyer_uuid, 'DOS-2026-0127', 'Litige foncier — Succession Nkeng c/ Administration',
     'Droit foncier', ARRAY['Succession Nkeng', 'Ministère des Domaines'],
     'active', 'high', ARRAY['foncier', 'succession', 'recours administratif'],
     'Fotso Mbarga', 4, 0, now() - interval '7 days', now() - interval '50 days'),
    (case5_uuid, lawyer_uuid, 'DOS-2026-0119', 'Rupture de contrat commercial — SARL Biya Tech c/ SARL Nguemo Solutions',
     'Droit commercial OHADA', ARRAY['SARL Biya Tech', 'SARL Nguemo Solutions'],
     'closed', 'medium', ARRAY['rupture de contrat', 'dommages-intérêts'],
     'Fotso Mbarga', 6, 4, now() - interval '16 days', now() - interval '94 days')
  ON CONFLICT (id) DO NOTHING;

  -- Timeline events for case1
  INSERT INTO public.case_timeline_events (case_id, lawyer_id, event_type, label, user_name, created_at)
  VALUES
    (case1_uuid, lawyer_uuid, 'analysis', 'Analyse de situation lancée', 'Fotso Mbarga', now() - interval '1 day'),
    (case1_uuid, lawyer_uuid, 'document', 'Mise en demeure générée et exportée en PDF', 'Fotso Mbarga', now() - interval '3 days'),
    (case1_uuid, lawyer_uuid, 'search', 'Recherche : Art. 40-42 Code du Travail', 'Fotso Mbarga', now() - interval '6 days'),
    (case1_uuid, lawyer_uuid, 'qa', 'Q&A : obligations employeur licenciement économique', 'Fotso Mbarga', now() - interval '10 days'),
    (case1_uuid, lawyer_uuid, 'create', 'Dossier créé', 'Fotso Mbarga', now() - interval '15 days')
  ON CONFLICT (id) DO NOTHING;

  -- Parties for case1
  INSERT INTO public.case_parties (case_id, name, quality, contact)
  VALUES
    (case1_uuid, 'Mme Nkeng Abanda', 'Salariée — Demanderesse', 'nkeng.abanda@email.cm'),
    (case1_uuid, 'SARL Fotso & Associés', 'Employeur — Défendeur', 'contact@fotso-associes.cm')
  ON CONFLICT (id) DO NOTHING;

  -- Evidence for case1
  INSERT INTO public.case_evidence (case_id, name, evidence_status, notes)
  VALUES
    (case1_uuid, 'Lettre de licenciement', 'to_gather', 'À demander à l''employeur'),
    (case1_uuid, 'Contrat de travail signé', 'to_gather', ''),
    (case1_uuid, 'Attestation de travail', 'available', 'Reçue le 29/05/2026'),
    (case1_uuid, 'Bulletins de salaire (12 mois)', 'to_gather', ''),
    (case1_uuid, 'PV consultation délégués du personnel', 'missing', 'Probablement inexistant')
  ON CONFLICT (id) DO NOTHING;

  -- Analyses for case1
  INSERT INTO public.case_analyses (case_id, lawyer_id, title, confidence_score, risk_level, created_at)
  VALUES
    (case1_uuid, lawyer_uuid, 'Analyse de licenciement économique', 72, 'medium', now() - interval '1 day'),
    (case1_uuid, lawyer_uuid, 'Évaluation des indemnités légales', 85, 'low', now() - interval '5 days'),
    (case1_uuid, lawyer_uuid, 'Analyse procédurale CRTV', 60, 'high', now() - interval '10 days')
  ON CONFLICT (id) DO NOTHING;

  -- Documents for case1
  INSERT INTO public.case_documents (case_id, lawyer_id, name, file_type, file_size, created_at)
  VALUES
    (case1_uuid, lawyer_uuid, 'Mise en demeure — 15/07/2026', 'docx', '24 Ko', now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
