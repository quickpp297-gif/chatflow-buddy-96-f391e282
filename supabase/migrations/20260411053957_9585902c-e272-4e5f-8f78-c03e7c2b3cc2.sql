
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', true);

CREATE POLICY "Public read whatsapp media" ON storage.objects FOR SELECT USING (bucket_id = 'whatsapp-media');
CREATE POLICY "Anyone can upload whatsapp media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'whatsapp-media');
