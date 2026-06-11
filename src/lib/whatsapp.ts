import { supabase } from "@/integrations/supabase/client";

export interface Contact {
  id: string;
  account_id: string | null;
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
  account_id: string | null;
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
  account_id?: string | null;
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

export async function fetchContacts(accountId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("account_id", accountId)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as any) || [];
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

export async function fetchAutoReplies(accountId: string): Promise<AutoReply[]> {
  const { data, error } = await supabase
    .from("auto_replies")
    .select("*")
    .eq("account_id", accountId);
  if (error) throw error;
  return (data as any) || [];
}

export async function upsertAutoReply(reply: Partial<AutoReply> & { account_id?: string }) {
  if (reply.id) {
    const { error } = await supabase
      .from("auto_replies")
      .update(reply as any)
      .eq("id", reply.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("auto_replies").insert(reply as any);
    if (error) throw error;
  }
}

export async function deleteAutoReply(id: string) {
  const { error } = await supabase.from("auto_replies").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTemplates(accountId: string): Promise<Template[]> {
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("account_id", accountId);
  if (error) throw error;
  return (data as any) || [];
}

export async function sendTextMessage(accountId: string, to: string, message: string, contactId: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-send", {
    body: { account_id: accountId, action: "send_text", to, message, contact_id: contactId },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function sendMediaMessage(
  accountId: string,
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
      account_id: accountId,
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
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function sendTemplateMessage(
  accountId: string,
  to: string,
  templateName: string,
  language: string,
  components: any,
  contactId: string
) {
  const { data, error } = await supabase.functions.invoke("whatsapp-send", {
    body: {
      account_id: accountId,
      action: "send_template",
      to,
      template_name: templateName,
      language,
      components,
      contact_id: contactId,
    },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function markContactRead(contactId: string) {
  await supabase
    .from("contacts")
    .update({ unread_count: 0 })
    .eq("id", contactId);
}

export async function deleteContactChat(contactId: string) {
  const { error: messagesError } = await supabase
    .from("messages")
    .delete()
    .eq("contact_id", contactId);

  if (messagesError) throw messagesError;

  const { error: contactError } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (contactError) throw contactError;
}

export function isWindowOpen(contact: Contact): boolean {
  if (!contact.window_expires_at) return false;
  return new Date(contact.window_expires_at) > new Date();
}

export function subscribeToMessages(accountId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`messages-realtime-${accountId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `account_id=eq.${accountId}` },
      callback
    )
    .subscribe();
}

export function subscribeToContacts(accountId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`contacts-realtime-${accountId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "contacts", filter: `account_id=eq.${accountId}` },
      callback
    )
    .subscribe();
}

/**
 * Upload a file (e.g. recorded audio, image, video, doc) to the account's folder
 * and return its public URL.
 *
 * On Lovable preview / localhost  -> Supabase Storage (whatsapp-media bucket)
 * On any other host (e.g. Hostinger) -> POST to /uploads.php which writes the
 * file to the /uploads folder shipped with the dist build.
 */
export async function uploadAccountMedia(
  accountId: string,
  file: Blob,
  filename: string,
  contentType: string
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${accountId}/outgoing/${Date.now()}_${safeName}`;

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const useLocalUploads =
    host &&
    !host.endsWith("lovable.app") &&
    !host.endsWith("lovable.dev") &&
    host !== "localhost" &&
    host !== "127.0.0.1";

  if (useLocalUploads) {
    const form = new FormData();
    const fileObj =
      file instanceof File ? file : new File([file], safeName, { type: contentType });
    form.append("file", fileObj, safeName);
    form.append("account_id", accountId);
    form.append("path", path);

    // Use Vite BASE_URL so subdirectory deploys (e.g. bookskt.online/test/) work.
    const base = (import.meta as any).env?.BASE_URL || "/";
    const endpoint = `${base.replace(/\/$/, "")}/uploads.php`;
    const resp = await fetch(endpoint, { method: "POST", body: form });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Upload failed (${resp.status}): ${txt.slice(0, 200)}`);
    }
    const data = await resp.json().catch(() => null);
    if (!data?.url) throw new Error("Upload response missing url");
    // Return absolute URL (WhatsApp Cloud API requires public HTTPS URL).
    return data.url.startsWith("http")
      ? data.url
      : `${window.location.origin}${data.url.startsWith("/") ? "" : "/"}${data.url}`;
  }

  const { error } = await supabase.storage
    .from("whatsapp-media")
    .upload(path, file, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from("whatsapp-media").getPublicUrl(path).data.publicUrl;
}
