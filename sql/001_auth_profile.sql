-- Function to ensure a public.users profile exists and is synced for the authenticated user
-- SECURITY DEFINER: runs with elevated privileges to bypass RLS for controlled upsert

CREATE OR REPLACE FUNCTION public.ensure_user_exists(
  p_auth_user_id uuid,
  p_company_id integer,
  p_role user_role DEFAULT 'staff',
  p_email text DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := COALESCE(p_email, 'user-' || p_auth_user_id::text || '@local');
  v_name text := COALESCE(p_name, split_part(COALESCE(p_email, ''), '@', 1));
BEGIN
  INSERT INTO public.users (company_id, auth_user_id, name, email, password_hash, role, status)
  VALUES (p_company_id, p_auth_user_id, COALESCE(v_name, 'User'), v_email, 'supabase_auth', p_role, 'active')
  ON CONFLICT (auth_user_id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    role = EXCLUDED.role,
    status = 'active',
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = COALESCE(EXCLUDED.email, public.users.email),
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_exists(uuid, integer, user_role, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_exists(uuid, integer, user_role, text, text) TO authenticated;


