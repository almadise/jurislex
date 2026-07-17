-- ============================================================
-- juriLex — Audit Events Module
-- Table: audit_events (journal d'audit par dossier)
-- ============================================================

-- 1. TYPES
DROP TYPE IF EXISTS public.audit_action CASCADE;
CREATE TYPE public.audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'status_change',
  'view',
  'export',
  'analysis',
  'document',
  'note',
  'archive'
);

-- 2. TABLE
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action public.audit_action NOT NULL DEFAULT 'view',
  entity_type TEXT NOT NULL DEFAULT 'case',
  entity_id UUID,
  label TEXT NOT NULL,
  details JSONB DEFAULT '{}'::JSONB,
  user_name TEXT DEFAULT '',
  user_email TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_audit_events_case_id ON public.audit_events(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_lawyer_id ON public.audit_events(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON public.audit_events(action);

-- 4. ENABLE RLS
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES
DROP POLICY IF EXISTS "lawyers_manage_own_audit_events" ON public.audit_events;
CREATE POLICY "lawyers_manage_own_audit_events"
ON public.audit_events
FOR ALL
TO authenticated
USING (lawyer_id = auth.uid())
WITH CHECK (lawyer_id = auth.uid());

-- 6. MOCK DATA
DO $$
DECLARE
  existing_user_id UUID;
  existing_case_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cases'
      ) THEN
        SELECT id INTO existing_case_id FROM public.cases WHERE lawyer_id = existing_user_id LIMIT 1;

        IF existing_case_id IS NOT NULL THEN
          INSERT INTO public.audit_events (case_id, lawyer_id, action, entity_type, label, details, user_name, user_email)
          VALUES
            (existing_case_id, existing_user_id, 'create', 'case', 'Dossier créé', jsonb_build_object('reference', 'DOS-2025-0001'), 'Avocat Demo', 'demo@jurilex.cm'),
            (existing_case_id, existing_user_id, 'update', 'case', 'Statut modifié : brouillon → actif', jsonb_build_object('old_status', 'draft', 'new_status', 'active'), 'Avocat Demo', 'demo@jurilex.cm'),
            (existing_case_id, existing_user_id, 'analysis', 'case_analysis', 'Analyse juridique générée', jsonb_build_object('confidence', 87), 'Avocat Demo', 'demo@jurilex.cm'),
            (existing_case_id, existing_user_id, 'document', 'case_document', 'Document généré : Mise en demeure', jsonb_build_object('doc_type', 'docx'), 'Avocat Demo', 'demo@jurilex.cm'),
            (existing_case_id, existing_user_id, 'view', 'case', 'Dossier consulté', jsonb_build_object(), 'Avocat Demo', 'demo@jurilex.cm')
          ON CONFLICT (id) DO NOTHING;
        END IF;
      END IF;
    ELSE
      RAISE NOTICE 'No users found. Skipping audit_events mock data.';
    END IF;
  ELSE
    RAISE NOTICE 'Table user_profiles does not exist. Skipping audit_events mock data.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'audit_events mock data failed: %', SQLERRM;
END $$;
