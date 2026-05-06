import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authenticate caller
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { account_id, action } = body;
    if (!account_id) throw new Error("account_id required");

    const fail = (message: string, details?: unknown, status = 400) =>
      new Response(JSON.stringify({ error: message, details }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Validate ownership
    const { data: account } = await supabase
      .from("wa_accounts")
      .select("*")
      .eq("id", account_id)
      .maybeSingle();
    if (!account) throw new Error("Account not found");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (account.user_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TOKEN = account.access_token;
    const PHONE_ID = account.phone_number_id;
    if (!TOKEN || !PHONE_ID) throw new Error("WhatsApp credentials not configured for this account");

    const baseUrl = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;
    const headers = {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    };

    if (action === "send_text") {
      const { to, message, contact_id } = body;
      const r = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        console.error("text send failed", data);
        return fail(data.error?.message || "Text send failed", data.error || data, r.status || 400);
      }
      if (data.messages?.[0]?.id) {
        await supabase.from("messages").insert({
          account_id, contact_id,
          wa_message_id: data.messages[0].id,
          direction: "outgoing", message_type: "text",
          content: message, status: "sent",
          timestamp: new Date().toISOString(),
        });
        await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact_id);
      }
      return ok({ success: true, data });
    }

    if (action === "send_media") {
      const { to, media_type, media_url, caption, contact_id, mime_type, filename } = body;
      const payload: any = { messaging_product: "whatsapp", to, type: media_type };
      if (media_type === "image") payload.image = { link: media_url, caption: caption || "" };
      else if (media_type === "video") payload.video = { link: media_url, caption: caption || "" };
      else if (media_type === "audio") payload.audio = { link: media_url };
      else if (media_type === "document") payload.document = { link: media_url, caption: caption || "", filename: filename || "file" };
      else return fail("Unsupported media type", { media_type });

      const r = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok || data.error) {
        console.error("media send failed", media_type, mime_type, data);
        return fail(data.error?.message || "Media send failed", data.error || data, r.status || 400);
      }
      if (data.messages?.[0]?.id) {
        await supabase.from("messages").insert({
          account_id, contact_id,
          wa_message_id: data.messages[0].id,
          direction: "outgoing", message_type: media_type,
          content: caption || "", media_url, media_mime_type: mime_type || null, media_filename: filename || null,
          status: "sent", timestamp: new Date().toISOString(),
        });
        await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact_id);
      }
      return ok({ success: true, data });
    }

    if (action === "send_template") {
      const { to, template_name, language, components, contact_id } = body;
      const tpl: any = {
        messaging_product: "whatsapp", to, type: "template",
        template: { name: template_name, language: { code: language || "en" } },
      };
      if (components) tpl.template.components = components;
      const r = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(tpl) });
      const data = await r.json();
      if (!r.ok || data.error) {
        console.error("template send failed", data);
        return fail(data.error?.message || "Template send failed", data.error || data, r.status || 400);
      }
      if (data.messages?.[0]?.id) {
        await supabase.from("messages").insert({
          account_id, contact_id,
          wa_message_id: data.messages[0].id,
          direction: "outgoing", message_type: "template",
          content: `Template: ${template_name}`,
          template_name, template_data: components || null,
          status: "sent", timestamp: new Date().toISOString(),
        });
        await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact_id);
      }
      return ok({ success: true, data });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(obj: unknown) {
  return new Response(JSON.stringify(obj), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}