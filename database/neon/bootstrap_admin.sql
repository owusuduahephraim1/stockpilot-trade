-- First administrator bootstrap, run in the NEW Neon project's SQL Editor.
-- Create the owner's sign-in via Neon Auth first and replace the email below.
INSERT INTO public.profiles(id,email,full_name,role)
SELECT id,email,name,'admin' FROM neon_auth.user
WHERE email='<OWNER_EMAIL>'
ON CONFLICT (id) DO UPDATE SET role='admin',email=EXCLUDED.email;
