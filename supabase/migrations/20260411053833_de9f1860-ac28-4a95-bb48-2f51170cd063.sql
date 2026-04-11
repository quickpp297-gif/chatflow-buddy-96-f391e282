
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT,
  profile_pic_url TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  window_expires_at TIMESTAMP WITH TIME ZONE,
  is_window_open BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'template', 'sticker', 'location', 'reaction')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  template_name TEXT,
  template_data JSONB,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  category TEXT DEFAULT 'UTILITY',
  components JSONB,
  status TEXT DEFAULT 'APPROVED',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.auto_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('welcome', 'away', 'keyword', 'default')),
  trigger_keyword TEXT,
  reply_message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON public.whatsapp_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on templates" ON public.whatsapp_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on auto_replies" ON public.auto_replies FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_messages_contact_id ON public.messages(contact_id);
CREATE INDEX idx_messages_timestamp ON public.messages(timestamp DESC);
CREATE INDEX idx_contacts_last_message ON public.contacts(last_message_at DESC);
CREATE INDEX idx_messages_wa_id ON public.messages(wa_message_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.whatsapp_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_auto_replies_updated_at BEFORE UPDATE ON public.auto_replies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_settings (setting_key, setting_value) VALUES
  ('welcome_message', 'Hello! Welcome to our WhatsApp support. How can we help you today?'),
  ('away_message', 'Thank you for your message. We are currently away and will get back to you soon.'),
  ('away_mode', 'false'),
  ('auto_reply_enabled', 'true');

INSERT INTO public.auto_replies (trigger_type, reply_message, is_active) VALUES
  ('welcome', 'Hello! Welcome to our WhatsApp support. How can we help you today?', true),
  ('away', 'Thank you for your message. We are currently away and will get back to you soon.', false),
  ('default', 'Thank you for your message. Our team will respond shortly.', true);
