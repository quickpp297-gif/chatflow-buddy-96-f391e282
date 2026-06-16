import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWebPush } from "../_shared/webpush.ts";

const VAPID_PUBLIC = "BKt76w8Wo4KN4AUHQtJkL2MCf2hIygIu6gPq-glR-QNn_m0e_RdJP_kh3J3avIxDFBWToFWudwHJDwBbhdZupYQ";
const VAPID_PRIVATE = "Gc6dbnkVIQFh2xghVGt1NLCOzJOtK2mDkTXAY34cnDE";
const VAPID_SUBJECT = "mailto:admin@finoxpro.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UPLOADS_BASE_URL = (Deno.env.get("UPLOADS_BASE_URL") || "").replace(/\/$/, "");
const UPLOADS_SECRET = Deno.env.get("UPLOADS_SECRET") || "";

async function uploadIncomingToPhp(
  accountId: string,
  bytes: Uint8Array,
  filename: string,
  mime: string,
): Promise<string> {
  if (!UPLOADS_BASE_URL || !UPLOADS_SECRET) {
    throw new Error("UPLOADS_BASE_URL / UPLOADS_SECRET not configured");
  }
  const endpoint = `${UPLOADS_BASE_URL}/uploads.php`;
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename);
  form.append("account_id", accountId);
  form.append("direction", "incoming");
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "X-Upload-Secret": UPLOADS_SECRET },
    body: form,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`uploads.php ${r.status}: ${txt.slice(0, 200)}`);
  }
  const j = await r.json();
  if (!j?.url) throw new Error("uploads.php missing url");
  return j.url as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  // URL: /functions/v1/whatsapp-webhook/<accountId>
  const parts = url.pathname.split("/").filter(Boolean);
  const accountId = parts[parts.length - 1];

  // Lookup account credentials
  const { data: account, error: accErr } = await supabase
    .from("wa_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (accErr || !account) {
    console.error("Account not found:", accountId, accErr);
    return new Response("Account not found", { status: 404 });
  }

  // GET = verification handshake from Meta
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === account.verify_token) {
      console.log("Webhook verified for account", accountId);
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json();
    console.log("Webhook event for", accountId, ":", JSON.stringify(body).slice(0, 500));

    const TOKEN = account.access_token as string;
    const PHONE_ID = account.phone_number_id as string;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;

        // Status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await supabase
              .from("messages")
              .update({ status: status.status })
              .eq("wa_message_id", status.id);
          }
        }

        if (!value.messages) continue;

        for (const message of value.messages) {
          const from = message.from;
          const contactInfo = value.contacts?.[0];
          const contactName = contactInfo?.profile?.name || from;

          // Find or create contact (scoped to account)
          let { data: contact } = await supabase
            .from("contacts")
            .select("*")
            .eq("account_id", accountId)
            .eq("phone_number", from)
            .maybeSingle();

          if (!contact) {
            const { data: newC } = await supabase
              .from("contacts")
              .insert({
                account_id: accountId,
                phone_number: from,
                name: contactName,
                last_message_at: new Date().toISOString(),
                window_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                is_window_open: true,
                unread_count: 1,
              })
              .select()
              .single();
            contact = newC;
          } else {
            await supabase
              .from("contacts")
              .update({
                name: contact.name || contactName,
                last_message_at: new Date().toISOString(),
                window_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                is_window_open: true,
                unread_count: (contact.unread_count || 0) + 1,
              })
              .eq("id", contact.id);
          }

          // Parse type
          let messageType = message.type || "text";
          let content = "";
          let mediaId = "";
          let mediaMimeType = "";
          let mediaFilename = "";

          switch (messageType) {
            case "text": content = message.text?.body || ""; break;
            case "image":
              content = message.image?.caption || "";
              mediaId = message.image?.id || "";
              mediaMimeType = message.image?.mime_type || "image/jpeg";
              break;
            case "video":
              content = message.video?.caption || "";
              mediaId = message.video?.id || "";
              mediaMimeType = message.video?.mime_type || "video/mp4";
              break;
            case "audio":
            case "voice":
              mediaId = message.audio?.id || message.voice?.id || "";
              mediaMimeType = message.audio?.mime_type || message.voice?.mime_type || "audio/ogg";
              messageType = "audio";
              break;
            case "document":
              content = message.document?.caption || "";
              mediaId = message.document?.id || "";
              mediaMimeType = message.document?.mime_type || "";
              mediaFilename = message.document?.filename || "";
              break;
            case "sticker":
              mediaId = message.sticker?.id || "";
              mediaMimeType = message.sticker?.mime_type || "image/webp";
              break;
            case "location":
              content = JSON.stringify({
                latitude: message.location?.latitude,
                longitude: message.location?.longitude,
                name: message.location?.name,
                address: message.location?.address,
              });
              break;
            case "reaction": content = message.reaction?.emoji || ""; break;
            default:
              content = `Unsupported message type: ${messageType}`;
              messageType = "text";
          }

          // Download media from WhatsApp and push it to the Hostinger /uploads PHP endpoint.
          let mediaUrl = "";
          if (mediaId) {
            try {
              const r1 = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
                headers: { Authorization: `Bearer ${TOKEN}` },
              });
              const meta = await r1.json();
              if (meta.url) {
                const r2 = await fetch(meta.url, {
                  headers: { Authorization: `Bearer ${TOKEN}` },
                });
                const buf = new Uint8Array(await r2.arrayBuffer());
                const ext = (mediaMimeType.split("/")[1] || "bin").split(";")[0];
                const fname = mediaFilename && mediaFilename.length > 0
                  ? mediaFilename
                  : `${Date.now()}_${mediaId}.${ext}`;
                try {
                  mediaUrl = await uploadIncomingToPhp(accountId, buf, fname, mediaMimeType);
                } catch (upErr) {
                  console.error("uploads.php err", upErr);
                }
              }
            } catch (e) {
              console.error("media download err", e);
            }
          }

          await supabase.from("messages").insert({
            account_id: accountId,
            contact_id: contact!.id,
            wa_message_id: message.id,
            direction: "incoming",
            message_type: messageType,
            content,
            media_url: mediaUrl || null,
            media_mime_type: mediaMimeType || null,
            media_filename: mediaFilename || null,
            status: "delivered",
            timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
          });

          // Push notification to subscribed devices
          try {
            const { data: subs } = await supabase
              .from("push_subscriptions")
              .select("*")
              .eq("user_id", account.user_id);
            const title = contact!.name || from;
            const preview =
              messageType === "text" ? (content || "").slice(0, 120)
                : messageType === "image" ? "📷 Photo"
                : messageType === "video" ? "🎥 Video"
                : messageType === "audio" ? "🎤 Voice message"
                : messageType === "document" ? "📄 Document"
                : "New message";
            const payload = JSON.stringify({
              title,
              body: preview,
              tag: `c-${contact!.id}`,
              url: `/?contact=${contact!.id}`,
            });
            for (const s of subs || []) {
              try {
                const r = await sendWebPush(
                  { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
                  payload,
                  { publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE, subject: VAPID_SUBJECT }
                );
                if (!r.ok && (r.status === 404 || r.status === 410)) {
                  await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                }
              } catch (pushErr) { console.error("push err", pushErr); }
            }
          } catch (e) { console.error("push lookup err", e); }

          // Auto-reply: welcome (first incoming) / away / keyword
          await handleAutoReply(supabase, account, contact!, content, from, TOKEN, PHONE_ID);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendText(token: string, phoneId: string, to: string, body: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  return r.json();
}

async function sendImage(token: string, phoneId: string, to: string, link: string, caption: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link, caption },
    }),
  });
  return r.json();
}

async function saveOutgoing(
  supabase: any,
  accountId: string,
  contactId: string,
  type: string,
  content: string,
  mediaUrl: string | null,
  waId: string | null
) {
  await supabase.from("messages").insert({
    account_id: accountId,
    contact_id: contactId,
    wa_message_id: waId,
    direction: "outgoing",
    message_type: type,
    content,
    media_url: mediaUrl,
    status: "sent",
    timestamp: new Date().toISOString(),
  });
}

async function handleAutoReply(
  supabase: any,
  account: any,
  contact: any,
  messageContent: string,
  from: string,
  token: string,
  phoneId: string
) {
  // Away mode wins
  if (account.away_enabled && account.away_message) {
    const r = await sendText(token, phoneId, from, account.away_message);
    const wid = r?.messages?.[0]?.id || null;
    await saveOutgoing(supabase, account.id, contact.id, "text", account.away_message, null, wid);
    return;
  }

  // Welcome on first incoming message
  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("contact_id", contact.id)
    .eq("direction", "incoming");

  if (count === 1 && account.welcome_enabled) {
    if (account.welcome_image_url) {
      const r = await sendImage(token, phoneId, from, account.welcome_image_url, account.welcome_message || "");
      const wid = r?.messages?.[0]?.id || null;
      await saveOutgoing(
        supabase, account.id, contact.id, "image",
        account.welcome_message || "", account.welcome_image_url, wid
      );
    } else if (account.welcome_message) {
      const r = await sendText(token, phoneId, from, account.welcome_message);
      const wid = r?.messages?.[0]?.id || null;
      await saveOutgoing(supabase, account.id, contact.id, "text", account.welcome_message, null, wid);
    }
    return;
  }

  // Keyword auto-replies (account scoped)
  const { data: keywordReplies } = await supabase
    .from("auto_replies")
    .select("*")
    .eq("account_id", account.id)
    .eq("trigger_type", "keyword")
    .eq("is_active", true);

  if (keywordReplies?.length) {
    const lower = (messageContent || "").toLowerCase();
    for (const kr of keywordReplies) {
      if (kr.trigger_keyword && lower.includes(kr.trigger_keyword.toLowerCase())) {
        const r = await sendText(token, phoneId, from, kr.reply_message);
        const wid = r?.messages?.[0]?.id || null;
        await saveOutgoing(supabase, account.id, contact.id, "text", kr.reply_message, null, wid);
        return;
      }
    }
  }
}