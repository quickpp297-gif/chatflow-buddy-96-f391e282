import { supabase } from "@/integrations/supabase/client";

export type FlowType = "visual" | "sequence" | "meta";
export type TriggerType = "keyword" | "new_contact" | "any_message" | "manual";

export interface FlowStep {
  id: string;
  type: "message" | "image" | "template" | "delay" | "tag";
  content?: string;
  media_url?: string;
  template_name?: string;
  delay_seconds?: number;
}

export interface Flow {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  description: string | null;
  flow_type: FlowType;
  trigger_type: TriggerType;
  trigger_value: string | null;
  nodes: any[];
  edges: any[];
  steps: FlowStep[];
  meta_flow_json: any | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchFlows(accountId: string): Promise<Flow[]> {
  const { data, error } = await supabase
    .from("flows")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Flow[]) || [];
}

export async function createFlow(payload: Partial<Flow> & { account_id: string; user_id: string; name: string }) {
  const { data, error } = await supabase
    .from("flows")
    .insert([{
      account_id: payload.account_id,
      user_id: payload.user_id,
      name: payload.name,
      description: payload.description ?? null,
      flow_type: payload.flow_type ?? "visual",
      trigger_type: payload.trigger_type ?? "keyword",
      trigger_value: payload.trigger_value ?? null,
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
      steps: (payload.steps ?? []) as any,
      meta_flow_json: payload.meta_flow_json ?? null,
      is_active: payload.is_active ?? true,
    } as any])
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Flow;
}

export async function updateFlow(id: string, patch: Partial<Flow>) {
  const { error } = await supabase.from("flows").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteFlow(id: string) {
  const { error } = await supabase.from("flows").delete().eq("id", id);
  if (error) throw error;
}