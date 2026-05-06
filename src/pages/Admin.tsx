import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ShieldCheck, Trash2, MessageCircle, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Profile { id: string; email: string | null; display_name: string | null; created_at: string; }
interface AccRow {
  id: string; user_id: string; business_name: string;
  phone_number_id: string | null; display_phone: string | null;
  is_active: boolean | null; created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<AccRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { contacts: number; messages: number }>>({});
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (!isAdmin) { navigate("/"); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, isAdmin]);

  const refresh = async () => {
    setBusy(true);
    const [{ data: ps }, { data: as }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("wa_accounts").select("*").order("created_at", { ascending: false }),
    ]);
    setProfiles(ps || []);
    setAccounts(as || []);

    // Per-account counts
    const map: Record<string, { contacts: number; messages: number }> = {};
    for (const a of as || []) {
      const [{ count: cc }, { count: mc }] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("account_id", a.id),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("account_id", a.id),
      ]);
      map[a.id] = { contacts: cc || 0, messages: mc || 0 };
    }
    setCounts(map);
    setBusy(false);
  };

  const toggleActive = async (acc: AccRow) => {
    await supabase.from("wa_accounts").update({ is_active: !acc.is_active }).eq("id", acc.id);
    refresh();
  };

  const deleteAccount = async (id: string) => {
    if (!confirm("Delete this WhatsApp account and ALL its data?")) return;
    await supabase.from("wa_accounts").delete().eq("id", id);
    toast.success("Deleted");
    refresh();
  };

  const promoteAdmin = async (uid: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else toast.success("User promoted to admin");
  };

  const deleteUser = async (p: Profile) => {
    if (p.id === user?.id) { toast.error("You cannot delete yourself"); return; }
    if (!confirm(`Delete user ${p.email}? This removes ALL their accounts, messages and data.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: p.id },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed");
      return;
    }
    toast.success("User deleted");
    refresh();
  };

  if (busy) return <div className="h-[100dvh] flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-[100dvh] bg-secondary">
      <div className="bg-[hsl(var(--wa-header))] text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/")}><ArrowLeft size={22} /></button>
        <ShieldCheck size={20} />
        <h1 className="font-bold">FinoXPro · Admin Panel</h1>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <section className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <UserIcon size={18} /> Users ({profiles.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr><th className="py-2">Name</th><th>Email</th><th>Joined</th><th className="text-right pr-2">Actions</th></tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-border">
                    <td className="py-2 font-medium">{p.display_name || "—"}</td>
                    <td>{p.email}</td>
                    <td className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="text-right pr-2 whitespace-nowrap">
                      <button onClick={() => promoteAdmin(p.id)}
                        className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded mr-2">
                        Make Admin
                      </button>
                      <button onClick={() => deleteUser(p)}
                        className="text-xs px-2 py-1 bg-destructive text-destructive-foreground rounded">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MessageCircle size={18} /> WhatsApp Accounts ({accounts.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr><th className="py-2">Business</th><th>Owner</th><th>Phone ID</th><th>Contacts</th><th>Messages</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const owner = profiles.find((p) => p.id === a.user_id);
                  const c = counts[a.id] || { contacts: 0, messages: 0 };
                  return (
                    <tr key={a.id} className="border-b border-border">
                      <td className="py-2 font-medium">{a.business_name}</td>
                      <td className="text-muted-foreground">{owner?.email || a.user_id.slice(0, 8)}</td>
                      <td className="font-mono text-xs">{a.phone_number_id || "—"}</td>
                      <td>{c.contacts}</td>
                      <td>{c.messages}</td>
                      <td>
                        <button onClick={() => toggleActive(a)}
                          className={`text-xs px-2 py-1 rounded ${a.is_active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {a.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td>
                        <button onClick={() => deleteAccount(a.id)} className="text-destructive">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}