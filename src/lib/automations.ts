import { supabase } from "@/integrations/supabase/client";

export type AutomationTriggerType =
  | "new_message" | "new_contact" | "keyword" | "outside_hours"
  | "no_reply_24h" | "tag_added";

export type AutomationActionType =
  | "send_message" | "send_template" | "ai_reply"
  | "add_tag" | "remove_tag" | "assign_conversation"
  | "update_contact_field" | "create_deal"
  | "wait" | "condition" | "send_webhook" | "close_conversation";

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  config: Record<string, any>;
}

export interface Automation {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, any>;
  actions: AutomationAction[];
  is_active: boolean;
  runs_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchAutomations(accountId: string): Promise<Automation[]> {
  const { data, error } = await (supabase as any).from("automations")
    .select("*").eq("account_id", accountId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Automation[];
}

export async function createAutomation(payload: Partial<Automation> & { account_id: string; user_id: string }) {
  const { data, error } = await (supabase as any).from("automations").insert([{
    account_id: payload.account_id, user_id: payload.user_id,
    name: payload.name ?? "Untitled automation",
    trigger_type: payload.trigger_type ?? "new_message",
    trigger_config: payload.trigger_config ?? {},
    actions: payload.actions ?? [],
    is_active: payload.is_active ?? false,
  }]).select().single();
  if (error) throw error;
  return data as Automation;
}

export async function updateAutomation(id: string, patch: Partial<Automation>) {
  const { error } = await (supabase as any).from("automations").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAutomation(id: string) {
  const { error } = await (supabase as any).from("automations").delete().eq("id", id);
  if (error) throw error;
}