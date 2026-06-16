
-- 1) has_role(): remove direct API execute. Still works inside RLS policies because it is SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2) Storage UPDATE policy for whatsapp-media bucket (mirrors existing ownership-scoped policies)
DROP POLICY IF EXISTS "wa_media_update_own" ON storage.objects;
CREATE POLICY "wa_media_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) Realtime channels: require authentication to subscribe. Postgres-changes events still
-- respect per-table RLS on contacts/messages, but this blocks anonymous Realtime listeners.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime' AND c.relname = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_can_listen" ON realtime.messages';
    EXECUTE $p$CREATE POLICY "authenticated_can_listen" ON realtime.messages FOR SELECT TO authenticated USING (true)$p$;
  END IF;
END $$;
