import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!;
  const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
  const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WEBHOOK_VERIFY_TOKEN") || "lovable_verify_token";

  // GET = webhook verification from Facebook
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST = incoming webhook events
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Webhook received:", JSON.stringify(body));

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "messages") continue;
          const value = change.value;

          // Handle status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              const { data: msg } = await supabase
                .from("messages")
                .update({ status: status.status })
                .eq("wa_message_id", status.id);
              console.log("Status updated:", status.id, status.status);
            }
          }

          // Handle incoming messages
          if (value.messages) {
            for (const message of value.messages) {
              const from = message.from;
              const contactInfo = value.contacts?.[0];
              const contactName = contactInfo?.profile?.name || from;

              // Upsert contact
              const { data: contact, error: contactError } = await supabase
                .from("contacts")
                .upsert(
                  {
                    phone_number: from,
                    name: contactName,
                    last_message_at: new Date().toISOString(),
                    window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    is_window_open: true,
                  },
                  { onConflict: "phone_number" }
                )
                .select()
                .single();

              if (contactError) {
                console.error("Contact upsert error:", contactError);
                continue;
              }

              // Update unread count
              await supabase
                .from("contacts")
                .update({ unread_count: (contact.unread_count || 0) + 1 })
                .eq("id", contact.id);

              // Determine message type and content
              let messageType = message.type || "text";
              let content = "";
              let mediaUrl = "";
              let mediaMimeType = "";
              let mediaFilename = "";

              switch (messageType) {
                case "text":
                  content = message.text?.body || "";
                  break;
                case "image":
                  content = message.image?.caption || "";
                  mediaUrl = message.image?.id || "";
                  mediaMimeType = message.image?.mime_type || "image/jpeg";
                  break;
                case "video":
                  content = message.video?.caption || "";
                  mediaUrl = message.video?.id || "";
                  mediaMimeType = message.video?.mime_type || "video/mp4";
                  break;
                case "audio":
                  mediaUrl = message.audio?.id || "";
                  mediaMimeType = message.audio?.mime_type || "audio/ogg";
                  break;
                case "document":
                  content = message.document?.caption || "";
                  mediaUrl = message.document?.id || "";
                  mediaMimeType = message.document?.mime_type || "";
                  mediaFilename = message.document?.filename || "";
                  break;
                case "sticker":
                  mediaUrl = message.sticker?.id || "";
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
                case "reaction":
                  content = message.reaction?.emoji || "";
                  break;
                default:
                  content = `Unsupported message type: ${messageType}`;
                  messageType = "text";
              }

              // If media has an ID, download it to get the URL
              if (mediaUrl && mediaUrl !== "") {
                try {
                  // Get media URL from WhatsApp
                  const mediaResponse = await fetch(
                    `https://graph.facebook.com/v21.0/${mediaUrl}`,
                    {
                      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
                    }
                  );
                  const mediaData = await mediaResponse.json();
                  if (mediaData.url) {
                    // Download media
                    const downloadResponse = await fetch(mediaData.url, {
                      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
                    });
                    const blob = await downloadResponse.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    // Upload to Supabase storage
                    const fileName = `${Date.now()}_${mediaUrl}`;
                    const bucketName = "whatsapp-media";
                    
                    const { data: uploadData, error: uploadError } = await supabase
                      .storage
                      .from(bucketName)
                      .upload(`incoming/${fileName}`, uint8Array, {
                        contentType: mediaMimeType,
                      });

                    if (!uploadError && uploadData) {
                      const { data: publicUrl } = supabase
                        .storage
                        .from(bucketName)
                        .getPublicUrl(`incoming/${fileName}`);
                      mediaUrl = publicUrl.publicUrl;
                    } else {
                      console.error("Upload error:", uploadError);
                    }
                  }
                } catch (e) {
                  console.error("Media download error:", e);
                }
              }

              // Save message
              const { error: msgError } = await supabase
                .from("messages")
                .insert({
                  contact_id: contact.id,
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

              if (msgError) {
                console.error("Message insert error:", msgError);
              }

              // Check for auto-replies
              await handleAutoReply(supabase, contact, content, from, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

async function handleAutoReply(
  supabase: any,
  contact: any,
  messageContent: string,
  from: string,
  token: string,
  phoneId: string
) {
  // Check if auto reply is enabled
  const { data: autoSetting } = await supabase
    .from("whatsapp_settings")
    .select("setting_value")
    .eq("setting_key", "auto_reply_enabled")
    .single();

  if (autoSetting?.setting_value !== "true") return;

  // Check away mode
  const { data: awaySetting } = await supabase
    .from("whatsapp_settings")
    .select("setting_value")
    .eq("setting_key", "away_mode")
    .single();

  if (awaySetting?.setting_value === "true") {
    const { data: awayReply } = await supabase
      .from("auto_replies")
      .select("reply_message")
      .eq("trigger_type", "away")
      .eq("is_active", true)
      .single();

    if (awayReply) {
      await sendWhatsAppMessage(token, phoneId, from, awayReply.reply_message);
      await saveOutgoingMessage(supabase, contact.id, awayReply.reply_message);
    }
    return;
  }

  // Check if this is the first message (welcome)
  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("contact_id", contact.id)
    .eq("direction", "incoming");

  if (count === 1) {
    const { data: welcomeReply } = await supabase
      .from("auto_replies")
      .select("reply_message")
      .eq("trigger_type", "welcome")
      .eq("is_active", true)
      .single();

    if (welcomeReply) {
      await sendWhatsAppMessage(token, phoneId, from, welcomeReply.reply_message);
      await saveOutgoingMessage(supabase, contact.id, welcomeReply.reply_message);
      return;
    }
  }

  // Check keyword triggers
  const { data: keywordReplies } = await supabase
    .from("auto_replies")
    .select("*")
    .eq("trigger_type", "keyword")
    .eq("is_active", true);

  if (keywordReplies) {
    for (const kr of keywordReplies) {
      if (kr.trigger_keyword && messageContent.toLowerCase().includes(kr.trigger_keyword.toLowerCase())) {
        await sendWhatsAppMessage(token, phoneId, from, kr.reply_message);
        await saveOutgoingMessage(supabase, contact.id, kr.reply_message);
        return;
      }
    }
  }
}

async function sendWhatsAppMessage(token: string, phoneId: string, to: string, text: string) {
  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

async function saveOutgoingMessage(supabase: any, contactId: string, content: string) {
  await supabase.from("messages").insert({
    contact_id: contactId,
    direction: "outgoing",
    message_type: "text",
    content,
    status: "sent",
    timestamp: new Date().toISOString(),
  });
}
