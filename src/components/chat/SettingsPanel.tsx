import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAutoReplies, upsertAutoReply, deleteAutoReply, AutoReply,
} from "@/lib/whatsapp";
import { useAccount, WaAccount } from "@/hooks/useAccount";
import {
  ArrowLeft, Save, Plus, Trash2, ToggleLeft, ToggleRight, Globe, Copy, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface Props { onBack: () => void; }

export function SettingsPanel({ onBack }: Props) {
  const { current, accounts, refresh, setCurrentId } = useAccount();
  const [account, setAccount] = useState<WaAccount | null>(current);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"account" | "messages" | "auto" | "webhook">("account");
  const [showToken, setShowToken] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newReply, setNewReply] = useState("");
  const [newAccName, setNewAccName] = useState("");

  useEffect(() => { setAccount(current); }, [current]);

  useEffect(() => {
    if (!current) { setLoading(false); return; }
    fetchAutoReplies(current.id).then(setAutoReplies).finally(() => setLoading(false));
  }, [current]);

  if (!current || !account) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-muted-foreground">
        No account
      </div>
    );
  }

  const saveAccount = async (patch: Partial<WaAccount>) => {
    const { error } = await supabase
      .from("wa_accounts")
      .update(patch)
      .eq("id", account.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    refresh();
  };

  const createAccount = async () => {
    if (!newAccName.trim()) return;
    const { data, error } = await supabase
      .from("wa_accounts")
      .insert({ user_id: current.user_id, business_name: newAccName.trim() })
      .select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Account created");
    setNewAccName("");
    await refresh();
    setCurrentId(data.id);
  };

  const deleteAccount = async () => {
    if (!confirm("Delete this WhatsApp account and ALL its chats?")) return;
    await supabase.from("wa_accounts").delete().eq("id", account.id);
    toast.success("Deleted");
    await refresh();
    onBack();
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim() || !newReply.trim()) return;
    await upsertAutoReply({
      account_id: account.id,
      trigger_type: "keyword",
      trigger_keyword: newKeyword.trim(),
      reply_message: newReply.trim(),
      is_active: true,
    });
    setNewKeyword(""); setNewReply("");
    fetchAutoReplies(account.id).then(setAutoReplies);
    toast.success("Added");
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook/${account.id}`;

  const tabs = [
    { id: "account" as const, label: "Account" },
    { id: "messages" as const, label: "Messages" },
    { id: "auto" as const, label: "Auto Reply" },
    { id: "webhook" as const, label: "Webhook" },
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--wa-header))] shrink-0">
        <button onClick={onBack} className="text-primary-foreground"><ArrowLeft size={22} /></button>
        <h1 className="text-lg font-bold text-primary-foreground flex-1">Settings</h1>

        {accounts.length > 1 && (
          <select
            value={account.id}
            onChange={(e) => setCurrentId(e.target.value)}
            className="bg-primary-foreground/20 text-primary-foreground text-sm rounded-lg px-2 py-1.5 border border-primary-foreground/30"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="text-foreground">{a.business_name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex border-b border-border shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-[100px] py-2.5 text-sm font-medium ${activeTab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? <p className="text-center text-muted-foreground py-8">Loading...</p> :
          <div className="max-w-lg mx-auto space-y-5">

            {activeTab === "account" && (
              <>
                <Field label="Business Name">
                  <input type="text" value={account.business_name}
                    onChange={(e) => setAccount({ ...account, business_name: e.target.value })}
                    onBlur={() => saveAccount({ business_name: account.business_name })}
                    className="input" />
                </Field>

                <Field label="WhatsApp Phone Number ID" hint="From Meta Developer → WhatsApp → API Setup">
                  <input type="text" value={account.phone_number_id || ""}
                    onChange={(e) => setAccount({ ...account, phone_number_id: e.target.value })}
                    onBlur={() => saveAccount({ phone_number_id: account.phone_number_id })}
                    className="input font-mono" placeholder="e.g. 123456789012345" />
                </Field>

                <Field label="WhatsApp Access Token" hint="Permanent System User Token">
                  <div className="relative">
                    <input type={showToken ? "text" : "password"} value={account.access_token || ""}
                      onChange={(e) => setAccount({ ...account, access_token: e.target.value })}
                      onBlur={() => saveAccount({ access_token: account.access_token })}
                      className="input pr-10 font-mono" placeholder="EAAB..." />
                    <button type="button" onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <Field label="Display Phone (optional)">
                  <input type="text" value={account.display_phone || ""}
                    onChange={(e) => setAccount({ ...account, display_phone: e.target.value })}
                    onBlur={() => saveAccount({ display_phone: account.display_phone })}
                    className="input" placeholder="+91 90000 00000" />
                </Field>

                <hr className="border-border" />

                <div>
                  <h3 className="text-sm font-medium mb-2">Manage Accounts</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder="New account name"
                      value={newAccName} onChange={(e) => setNewAccName(e.target.value)}
                      className="input flex-1" />
                    <button onClick={createAccount} className="btn-primary">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <button onClick={deleteAccount}
                    className="mt-3 text-sm text-destructive flex items-center gap-1">
                    <Trash2 size={14} /> Delete this account
                  </button>
                </div>
              </>
            )}

            {activeTab === "messages" && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Welcome Message</p>
                    <p className="text-xs text-muted-foreground">Sent to new contacts on first message</p>
                  </div>
                  <ToggleBtn on={!!account.welcome_enabled}
                    onClick={() => saveAccount({ welcome_enabled: !account.welcome_enabled })} />
                </div>
                <Field label="Welcome Image URL (optional)">
                  <input type="url" value={account.welcome_image_url || ""}
                    onChange={(e) => setAccount({ ...account, welcome_image_url: e.target.value })}
                    onBlur={() => saveAccount({ welcome_image_url: account.welcome_image_url })}
                    className="input" placeholder="https://example.com/welcome.jpg" />
                </Field>
                <Field label="Welcome Text / Caption">
                  <textarea rows={3} value={account.welcome_message || ""}
                    onChange={(e) => setAccount({ ...account, welcome_message: e.target.value })}
                    onBlur={() => saveAccount({ welcome_message: account.welcome_message })}
                    className="input resize-none" />
                </Field>

                <hr className="border-border" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Away Mode</p>
                    <p className="text-xs text-muted-foreground">Auto-replies to every incoming message</p>
                  </div>
                  <ToggleBtn on={!!account.away_enabled}
                    onClick={() => saveAccount({ away_enabled: !account.away_enabled })} />
                </div>
                <Field label="Away Message">
                  <textarea rows={3} value={account.away_message || ""}
                    onChange={(e) => setAccount({ ...account, away_message: e.target.value })}
                    onBlur={() => saveAccount({ away_message: account.away_message })}
                    className="input resize-none" />
                </Field>
              </>
            )}

            {activeTab === "auto" && (
              <>
                <h3 className="text-sm font-medium">Keyword Auto-Replies</h3>
                {autoReplies.filter((r) => r.trigger_type === "keyword").map((r) => (
                  <div key={r.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        Keyword: <span className="text-primary">{r.trigger_keyword}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <ToggleBtn on={!!r.is_active}
                          onClick={async () => { await upsertAutoReply({ id: r.id, is_active: !r.is_active }); fetchAutoReplies(account.id).then(setAutoReplies); }} />
                        <button className="text-destructive"
                          onClick={async () => { await deleteAutoReply(r.id); fetchAutoReplies(account.id).then(setAutoReplies); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.reply_message}</p>
                  </div>
                ))}

                <div className="border border-dashed border-border rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-2">Add New</h4>
                  <input type="text" placeholder="Trigger keyword (e.g. price)"
                    value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                    className="input mb-2" />
                  <textarea rows={2} placeholder="Reply message"
                    value={newReply} onChange={(e) => setNewReply(e.target.value)}
                    className="input resize-none mb-2" />
                  <button onClick={handleAddKeyword}
                    disabled={!newKeyword.trim() || !newReply.trim()}
                    className="btn-primary">
                    <Plus size={14} /> Add
                  </button>
                </div>
              </>
            )}

            {activeTab === "webhook" && (
              <>
                <Field label="Your Unique Callback URL"
                  hint="Paste this in Meta Developer → WhatsApp → Configuration → Callback URL">
                  <div className="flex items-center gap-2">
                    <input readOnly value={webhookUrl}
                      className="input font-mono text-xs" />
                    <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}
                      className="btn-primary"><Copy size={14} /></button>
                  </div>
                </Field>

                <Field label="Verify Token" hint="Use this exact value in Meta Developer Console">
                  <div className="flex items-center gap-2">
                    <input readOnly value={account.verify_token}
                      className="input font-mono text-xs" />
                    <button onClick={() => { navigator.clipboard.writeText(account.verify_token); toast.success("Copied!"); }}
                      className="btn-primary"><Copy size={14} /></button>
                  </div>
                </Field>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                    <Globe size={16} /> Setup Steps
                  </h4>
                  <ol className="text-xs text-muted-foreground space-y-2 list-decimal ml-4">
                    <li>Save your Phone Number ID and Access Token under "Account" tab.</li>
                    <li>Go to Meta Developer → Your App → WhatsApp → Configuration.</li>
                    <li>Set Callback URL to the URL above.</li>
                    <li>Set Verify Token to the value above.</li>
                    <li>Subscribe to <code className="bg-card px-1 rounded">messages</code> webhook field.</li>
                    <li>Send a message to your WhatsApp business number to test.</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        }
      </div>

      <style>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: hsl(var(--primary)); }
        .btn-primary { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.5rem 0.75rem; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; }
        .btn-primary:disabled { opacity: 0.5; }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function ToggleBtn({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={on ? "text-primary" : "text-muted-foreground"}>
      {on ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
    </button>
  );
}