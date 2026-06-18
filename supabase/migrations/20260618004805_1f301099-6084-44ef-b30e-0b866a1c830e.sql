
CREATE TABLE IF NOT EXISTS public.flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.wa_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  flow_type TEXT NOT NULL DEFAULT 'visual' CHECK (flow_type IN ('visual','sequence','meta')),
  trigger_type TEXT NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword','new_contact','any_message','manual')),
  trigger_value TEXT,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta_flow_json JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flows TO authenticated;
GRANT ALL ON public.flows TO service_role;

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own flows" ON public.flows;
CREATE POLICY "Users manage their own flows" ON public.flows
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS flows_account_idx ON public.flows(account_id);

DROP TRIGGER IF EXISTS flows_updated_at ON public.flows;
CREATE TRIGGER flows_updated_at BEFORE UPDATE ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
