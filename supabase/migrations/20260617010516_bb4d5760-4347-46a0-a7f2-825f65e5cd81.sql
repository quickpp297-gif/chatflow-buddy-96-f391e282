
-- Restore execute on has_role so RLS policies and app code keep working.
-- (SECURITY DEFINER means inner SELECT still bypasses caller RLS.)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Ensure storage UPDATE policy exists (idempotent)
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
