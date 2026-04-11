import { supabase } from "@/integrations/supabase/client";

export interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  profile_pic_url: string | null;
  last_message_at: string | null;
  window_expires_at: string | null;
  is_window_open: boolean | null;
  unread_count: number | null;
}

export interface Message {
  id: string;
  contact_id: string;
  wa_message_id: string | null;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  template_name: string | null;
  template_data: any;
  status: string | null;
  timestamp: string;
}

export interface WhatsAppSettings {
  id: string;
  setting_key: string;
  setting_value: string | null;
}

export interface AutoReply {
  id: string;
  trigger_type: string;
  trigger_keyword: string | null;
  reply_message: string;
  is_active: boolean | null;
}

export interface Template {
  id: string;
  name: string;
  language: string;
  category: string | null;
  components: any;
  status: string | null;
}

export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function fetchMessages(contactId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("contact_id", contactId)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("whatsapp_settings").select("*");
  if (error) throw error;
  const settings: Record<string, string> = {};
  data?.forEach((s: WhatsAppSettings) => {
    settings[s.setting_key] = s.setting_value || "";
  });
  return settings;
}

export async function updateSetting(key: string, value: string) {
  const { error } = await supabase
    .from("whatsapp_settings")
    .update({ setting_value: value })
    .eq("setting_key", key);
  if (error) throw error;
}

export async function fetchAutoReplies(): Promise<AutoReply[]> {
  const { data, error } = await supabase.from("auto_replies").select("*");
  if (error) throw error;
  return data || [];
}

export async function upsertAutoReply(reply: Partial<AutoReply>) {
  if (reply.id) {
    const { error } = await supabase
      .from("auto_replies")
      .update(reply)
      .eq("id", reply.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("auto_replies").insert(reply);
    if (error) throw error;
  }
}

export async function deleteAutoReply(id: string) {
  const { error } = await supabase.from("auto_replies").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase.from("whatsapp_templates").select("*");
  if (error) throw error;
  return data || [];
}

export async function sendTextMessage(to: string, message: string, contactId: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-send", {
    body: { action: "send_text", to, message, contact_id: contactId },
  });
  if (error) throw error;
  return data;
}

export async function sendMediaMessage(
  to: string,
  mediaType: string,
  mediaUrl: string,
  caption: string,
  contactId: string,
  mimeType?: string,
  filename?: string
) {
  const { data, error } = await supabase.functions.invoke("whatsapp-send", {
    body: {
      action: "send_media",
      to,
      media_type: mediaType,
      media_url: mediaUrl,
      caption,
      contact_id: contactId,
      mime_type: mimeType,
      filename,
    },
  });
  if (error) throw error;
  return data;
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  language: string,
  components: any,
  contactId: string
) {
  const { data, error } = await supabase.functions.invoke("whatsapp-send", {
    body: {
      action: "send_template",
      to,
      template_name: templateName,
      language,
      components,
      contact_id: contactId,
    },
  });
  if (error) throw error;
  return data;
}

export async function markContactRead(contactId: string) {
  await supabase
    .from("contacts")
    .update({ unread_count: 0 })
    .eq("id", contactId);
}

export function isWindowOpen(contact: Contact): boolean {
  if (!contact.window_expires_at) return false;
  return new Date(contact.window_expires_at) > new Date();
}

export function subscribeToMessages(callback: (payload: any) => void) {
  return supabase
    .channel("messages-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      callback
    )
    .subscribe();
}

export function subscribeToContacts(callback: (payload: any) => void) {
  return supabase
    .channel("contacts-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "contacts" },
      callback
    )
    .subscribe();
}
