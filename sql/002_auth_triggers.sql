-- Trigger to auto-create user profile on first login via auth

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger AS $$
DECLARE
  v_default_company_id integer;
BEGIN
  SELECT id INTO v_default_company_id FROM public.companies ORDER BY id LIMIT 1;
  PERFORM public.ensure_user_exists(NEW.id, v_default_company_id, 'staff', NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_created();


