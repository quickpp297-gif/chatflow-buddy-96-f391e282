-- ============ ENUM + ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- profiles policies
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ WA ACCOUNTS ============
CREATE TABLE public.wa_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT 'My WhatsApp',
  phone_number_id TEXT,
  access_token TEXT,
  verify_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  display_phone TEXT,
  welcome_enabled BOOLEAN DEFAULT true,
  welcome_message TEXT DEFAULT 'Hi! Welcome 👋 Thanks for messaging us.',
  welcome_image_url TEXT,
  away_enabled BOOLEAN DEFAULT false,
  away_message TEXT DEFAULT 'We are away right now. We will reply soon.',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wa_accounts_user ON public.wa_accounts(user_id);
CREATE INDEX idx_wa_accounts_verify ON public.wa_accounts(verify_token);

CREATE POLICY "Own accounts" ON public.wa_accounts FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ ATTACH account_id TO EXISTING TABLES ============
ALTER TABLE public.contacts ADD COLUMN account_id UUID REFERENCES public.wa_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN account_id UUID REFERENCES public.wa_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.auto_replies ADD COLUMN account_id UUID REFERENCES public.wa_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_templates ADD COLUMN account_id UUID REFERENCES public.wa_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_settings ADD COLUMN account_id UUID REFERENCES public.wa_accounts(id) ON DELETE CASCADE;

CREATE INDEX idx_contacts_account ON public.contacts(account_id);
CREATE INDEX idx_messages_account ON public.messages(account_id);
CREATE INDEX idx_messages_contact ON public.messages(contact_id);

-- Replace open-policies with secure ones
DROP POLICY IF EXISTS "Allow all on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow all on messages" ON public.messages;
DROP POLICY IF EXISTS "Allow all on auto_replies" ON public.auto_replies;
DROP POLICY IF EXISTS "Allow all on templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Allow all on settings" ON public.whatsapp_settings;

CREATE POLICY "account_owner_contacts" ON public.contacts FOR ALL
  USING (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "account_owner_messages" ON public.messages FOR ALL
  USING (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "account_owner_replies" ON public.auto_replies FOR ALL
  USING (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "account_owner_templates" ON public.whatsapp_templates FOR ALL
  USING (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "account_owner_settings" ON public.whatsapp_settings FOR ALL
  USING (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (account_id IN (SELECT id FROM public.wa_accounts WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ AUTO-CREATE PROFILE + ROLE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.wa_accounts (user_id, business_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'My WhatsApp') || '''s Business');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wa_accounts_updated BEFORE UPDATE ON public.wa_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE POLICIES (whatsapp-media bucket) ============
-- Path convention: {account_id}/incoming|outgoing/{file}
CREATE POLICY "wa_media_read_own" ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media' AND (
    public.has_role(auth.uid(), 'admin') OR
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.wa_accounts WHERE user_id = auth.uid())
  ));

CREATE POLICY "wa_media_upload_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-media' AND (
    public.has_role(auth.uid(), 'admin') OR
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.wa_accounts WHERE user_id = auth.uid())
  ));

CREATE POLICY "wa_media_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'whatsapp-media' AND (
    public.has_role(auth.uid(), 'admin') OR
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.wa_accounts WHERE user_id = auth.uid())
  ));