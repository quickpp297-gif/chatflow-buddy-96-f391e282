import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: udata } = await userClient.auth.getUser();
  const caller = udata?.user;
  if (!caller) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(url, service);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
  const isAdmin = roles?.some((r: any) => r.role === "admin");
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  try {
    const { user_id } = await req.json();
    if (!user_id) return json({ error: "user_id required" }, 400);
    if (user_id === caller.id) return json({ error: "Cannot delete yourself" }, 400);

    // Cascade-delete app data (no FK cascade defined to auth.users)
    const { data: accs } = await admin.from("wa_accounts").select("id").eq("user_id", user_id);
    const accIds = (accs || []).map((a: any) => a.id);
    if (accIds.length) {
      await admin.from("messages").delete().in("account_id", accIds);
      await admin.from("contacts").delete().in("account_id", accIds);
      await admin.from("auto_replies").delete().in("account_id", accIds);
      await admin.from("whatsapp_templates").delete().in("account_id", accIds);
      await admin.from("whatsapp_settings").delete().in("account_id", accIds);
      await admin.from("wa_accounts").delete().in("id", accIds);
    }
    await admin.from("push_subscriptions").delete().eq("user_id", user_id);
    await admin.from("user_roles").delete().eq("user_id", user_id);
    await admin.from("profiles").delete().eq("id", user_id);

    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) throw error;
    return json({ success: true });
  } catch (e: any) {
    console.error("delete user err", e);
    return json({ error: e.message }, 500);
  }

  function json(o: unknown, status = 200) {
    return new Response(JSON.stringify(o), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});