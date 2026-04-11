import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
  const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return new Response(
      JSON.stringify({ error: "WhatsApp credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "send_text": {
        const { to, message, contact_id } = body;
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: message },
            }),
          }
        );

        const data = await response.json();
        console.log("Send text response:", JSON.stringify(data));

        if (data.messages?.[0]?.id) {
          await supabase.from("messages").insert({
            contact_id,
            wa_message_id: data.messages[0].id,
            direction: "outgoing",
            message_type: "text",
            content: message,
            status: "sent",
            timestamp: new Date().toISOString(),
          });

          // Update contact last message
          await supabase
            .from("contacts")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", contact_id);
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_media": {
        const { to, media_type, media_url, caption, contact_id } = body;
        
        const mediaBody: any = {
          messaging_product: "whatsapp",
          to,
          type: media_type,
        };

        if (media_type === "image") {
          mediaBody.image = { link: media_url, caption: caption || "" };
        } else if (media_type === "video") {
          mediaBody.video = { link: media_url, caption: caption || "" };
        } else if (media_type === "audio") {
          mediaBody.audio = { link: media_url };
        } else if (media_type === "document") {
          mediaBody.document = { link: media_url, caption: caption || "", filename: body.filename || "document" };
        }

        const response = await fetch(
          `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(mediaBody),
          }
        );

        const data = await response.json();

        if (data.messages?.[0]?.id) {
          await supabase.from("messages").insert({
            contact_id,
            wa_message_id: data.messages[0].id,
            direction: "outgoing",
            message_type: media_type,
            content: caption || "",
            media_url,
            media_mime_type: body.mime_type || "",
            status: "sent",
            timestamp: new Date().toISOString(),
          });

          await supabase
            .from("contacts")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", contact_id);
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_template": {
        const { to, template_name, language, components, contact_id } = body;

        const templateBody: any = {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: template_name,
            language: { code: language || "en" },
          },
        };

        if (components) {
          templateBody.template.components = components;
        }

        const response = await fetch(
          `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(templateBody),
          }
        );

        const data = await response.json();

        if (data.messages?.[0]?.id) {
          await supabase.from("messages").insert({
            contact_id,
            wa_message_id: data.messages[0].id,
            direction: "outgoing",
            message_type: "template",
            content: `Template: ${template_name}`,
            template_name,
            template_data: components || null,
            status: "sent",
            timestamp: new Date().toISOString(),
          });

          await supabase
            .from("contacts")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", contact_id);
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_media_url": {
        const { media_id } = body;
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${media_id}`,
          {
            headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
          }
        );
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "upload_media": {
        const { file_url, mime_type } = body;
        
        // Download the file
        const fileResponse = await fetch(file_url);
        const fileBlob = await fileResponse.blob();
        
        const formData = new FormData();
        formData.append("messaging_product", "whatsapp");
        formData.append("file", fileBlob, "file");
        formData.append("type", mime_type);

        const response = await fetch(
          `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            },
            body: formData,
          }
        );

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
