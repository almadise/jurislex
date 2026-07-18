-- ============================================================
-- juriLex — Fix: Grant EXECUTE on search RPC functions to anon + authenticated
-- Root cause: search_provisions_* functions were not callable by the anon role
-- used by the API route (which uses NEXT_PUBLIC_SUPABASE_ANON_KEY).
-- The functions are SECURITY DEFINER so they bypass RLS once called,
-- but they still need EXECUTE permission to be invoked.
-- ============================================================

-- Grant execute on all three search functions to both roles
GRANT EXECUTE ON FUNCTION public.search_provisions_exact(
  TEXT, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], INTEGER
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_provisions_lexical(
  TEXT, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], INTEGER
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_provisions_semantic(
  vector, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], INTEGER
) TO anon, authenticated;

-- Also add a public SELECT policy so the SECURITY DEFINER functions
-- can read legal_provisions rows regardless of the caller's auth state.
-- (SECURITY DEFINER runs as the function owner, but the owner still
--  needs a policy that allows SELECT when RLS is enabled.)
DROP POLICY IF EXISTS "public_read_legal_provisions" ON public.legal_provisions;
CREATE POLICY "public_read_legal_provisions"
ON public.legal_provisions
FOR SELECT
TO anon, authenticated
USING (true);
