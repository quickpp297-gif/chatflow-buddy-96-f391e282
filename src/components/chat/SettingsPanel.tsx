import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAutoReplies, upsertAutoReply, deleteAutoReply, AutoReply,
} from "@/lib/whatsapp";
import { useAccount, WaAccount } from "@/hooks/useAccount";
import {
  ArrowLeft, Save, Plus, Trash2, ToggleLeft, ToggleRight, Globe, Copy, Eye, EyeOff,
  Lock, User, MessageSquare, Zap, Webhook, KeyRound, Building2, Phone, Hash, Sparkles,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface Props { onBack: () => void; }

const SENSITIVE_PASSWORD = "12345@Lucky";
const UNLOCK_KEY = "wa_settings_unlocked_at";
const UNLOCK_TTL_MS = 15 * 60 * 1000; // 15 min session

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
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    const t = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
    return t > 0 && Date.now() - t < UNLOCK_TTL_MS;
  });
  const [pwInput, setPwInput] = useState("");

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
    { id: "account" as const, label: "Account", icon: User },
    { id: "messages" as const, label: "Messages", icon: MessageSquare },
    { id: "auto" as const, label: "Auto Reply", icon: Zap },
    { id: "webhook" as const, label: "Webhook", icon: Webhook },
  ];

  const tryUnlock = () => {
    if (pwInput === SENSITIVE_PASSWORD) {
      sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
      setUnlocked(true);
      setPwInput("");
      toast.success("Unlocked");
    } else {
      toast.error("Wrong password");
      setPwInput("");
    }
  };

  const lockNow = () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
    toast.success("Locked");
  };

  const needsLock = activeTab === "account" || activeTab === "webhook";
  const showLockGate = needsLock && !unlocked;

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-b from-secondary/40 to-background">
      {/* Header */}
      <div className="relative shrink-0 overflow-hidden bg-[hsl(var(--wa-header))] text-primary-foreground">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0%, transparent 50%), radial-gradient(circle at 80% 80%, #25d366 0%, transparent 50%)" }} />
        <div className="relative flex items-center gap-3 px-4 py-4">
          <button onClick={onBack}
            className="w-9 h-9 rounded-full hover:bg-primary-foreground/15 flex items-center justify-center transition">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight">Settings</h1>
            <p className="text-[11px] text-primary-foreground/70 truncate">{account.business_name}</p>
          </div>

          {unlocked && needsLock && (
            <button onClick={lockNow} title="Lock"
              className="w-9 h-9 rounded-full hover:bg-primary-foreground/15 flex items-center justify-center transition">
              <Lock size={16} />
            </button>
          )}

          {accounts.length > 1 && (
            <select
              value={account.id}
              onChange={(e) => setCurrentId(e.target.value)}
              className="bg-primary-foreground/15 text-primary-foreground text-xs rounded-lg px-2 py-1.5 border border-primary-foreground/20 backdrop-blur max-w-[140px]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="text-foreground">{a.business_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="relative flex gap-1 px-3 pb-3 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? "bg-primary-foreground text-[hsl(var(--wa-header))] shadow-md"
                    : "bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/15"
                }`}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {loading ? <p className="text-center text-muted-foreground py-8">Loading...</p> :
         showLockGate ? (
          <div className="max-w-sm mx-auto mt-10 relative">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/30 to-transparent blur-2xl opacity-60" />
            <div className="relative border border-border/60 rounded-2xl p-7 bg-card/80 backdrop-blur shadow-xl">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
                  <Lock size={24} className="text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold">Protected section</h3>
                <p className="text-xs text-muted-foreground mt-1.5 mb-5 leading-relaxed">
                  Enter password to {activeTab === "account" ? "edit account & API credentials" : "view webhook details"}.
                </p>
                <input
                  type="password"
                  autoFocus
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
                  placeholder="Password"
                  className="input mb-3 text-center tracking-widest"
                />
                <button onClick={tryUnlock} className="btn-primary w-full justify-center py-2.5">
                  <Lock size={14} /> Unlock
                </button>
              </div>
            </div>
          </div>
         ) :
          <div className="max-w-2xl mx-auto space-y-5">

            {activeTab === "account" && (
              <>
                <Card title="Business Profile" icon={Building2} desc="Public details shown across your workspace">
                  <Field label="Business Name" icon={Building2}>
                    <input type="text" value={account.business_name}
                      onChange={(e) => setAccount({ ...account, business_name: e.target.value })}
                      onBlur={() => saveAccount({ business_name: account.business_name })}
                      className="input" />
                  </Field>
                  <Field label="Display Phone (optional)" icon={Phone}>
                    <input type="text" value={account.display_phone || ""}
                      onChange={(e) => setAccount({ ...account, display_phone: e.target.value })}
                      onBlur={() => saveAccount({ display_phone: account.display_phone })}
                      className="input" placeholder="+91 90000 00000" />
                  </Field>
                </Card>

                <Card title="WhatsApp API Credentials" icon={KeyRound} desc="From Meta Developer Console" accent>
                  <Field label="Phone Number ID" icon={Hash} hint="API Setup → Phone number ID">
                    <input type="text" value={account.phone_number_id || ""}
                      onChange={(e) => setAccount({ ...account, phone_number_id: e.target.value })}
                      onBlur={() => saveAccount({ phone_number_id: account.phone_number_id })}
                      className="input font-mono" placeholder="e.g. 123456789012345" />
                  </Field>

                  <Field label="Access Token" icon={KeyRound} hint="Permanent System User Token">
                    <div className="relative">
                      <input type={showToken ? "text" : "password"} value={account.access_token || ""}
                        onChange={(e) => setAccount({ ...account, access_token: e.target.value })}
                        onBlur={() => saveAccount({ access_token: account.access_token })}
                        className="input pr-10 font-mono" placeholder="EAAB..." />
                      <button type="button" onClick={() => setShowToken(!showToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </Field>

                  {account.phone_number_id && account.access_token && (
                    <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
                      <Check size={14} /> Credentials configured
                    </div>
                  )}
                </Card>

                <Card title="Manage Accounts" icon={Sparkles} desc="Add or remove business workspaces">
                  <div className="flex gap-2">
                    <input type="text" placeholder="New account name"
                      value={newAccName} onChange={(e) => setNewAccName(e.target.value)}
                      className="input flex-1" />
                    <button onClick={createAccount} className="btn-primary">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <button onClick={deleteAccount}
                    className="mt-3 text-xs text-destructive hover:underline flex items-center gap-1">
                    <Trash2 size={13} /> Delete this account
                  </button>
                </Card>
              </>
            )}

            {activeTab === "messages" && (
              <>
                <Card title="Welcome Message" icon={Sparkles} desc="Sent to new contacts on first message"
                  action={<ToggleBtn on={!!account.welcome_enabled}
                    onClick={() => saveAccount({ welcome_enabled: !account.welcome_enabled })} />}>
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
                </Card>

                <Card title="Away Mode" icon={MessageSquare} desc="Auto-replies to every incoming message"
                  action={<ToggleBtn on={!!account.away_enabled}
                    onClick={() => saveAccount({ away_enabled: !account.away_enabled })} />}>
                  <Field label="Away Message">
                    <textarea rows={3} value={account.away_message || ""}
                      onChange={(e) => setAccount({ ...account, away_message: e.target.value })}
                      onBlur={() => saveAccount({ away_message: account.away_message })}
                      className="input resize-none" />
                  </Field>
                </Card>
              </>
            )}

            {activeTab === "auto" && (
              <>
                <Card title="Keyword Auto-Replies" icon={Zap} desc="Trigger a response when a keyword arrives">
                  <div className="space-y-2">
                    {autoReplies.filter((r) => r.trigger_type === "keyword").length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No keyword replies yet</p>
                    )}
                    {autoReplies.filter((r) => r.trigger_type === "keyword").map((r) => (
                      <div key={r.id} className="border border-border rounded-xl p-3 bg-secondary/30 hover:bg-secondary/50 transition group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md">
                            <Zap size={11} /> {r.trigger_keyword}
                          </span>
                          <div className="flex items-center gap-2">
                            <ToggleBtn on={!!r.is_active}
                              onClick={async () => { await upsertAutoReply({ id: r.id, is_active: !r.is_active }); fetchAutoReplies(account.id).then(setAutoReplies); }} />
                            <button className="text-destructive opacity-60 hover:opacity-100 transition"
                              onClick={async () => { await deleteAutoReply(r.id); fetchAutoReplies(account.id).then(setAutoReplies); }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{r.reply_message}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Add New Auto-Reply" icon={Plus} desc="Match an incoming keyword and reply instantly" accent>
                  <Field label="Trigger Keyword">
                    <input type="text" placeholder="e.g. price"
                      value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                      className="input" />
                  </Field>
                  <Field label="Reply Message">
                    <textarea rows={3} placeholder="Type the reply your customer will receive…"
                      value={newReply} onChange={(e) => setNewReply(e.target.value)}
                      className="input resize-none" />
                  </Field>
                  <button onClick={handleAddKeyword}
                    disabled={!newKeyword.trim() || !newReply.trim()}
                    className="btn-primary w-full justify-center py-2.5">
                    <Plus size={14} /> Add Auto-Reply
                  </button>
                </Card>
              </>
            )}

            {activeTab === "webhook" && (
              <>
                <Card title="Webhook Endpoint" icon={Webhook} desc="Meta will post incoming messages here" accent>
                  <Field label="Callback URL"
                    hint="Paste this in Meta Developer → WhatsApp → Configuration">
                    <div className="flex items-center gap-2">
                      <input readOnly value={webhookUrl}
                        className="input font-mono text-xs" />
                      <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}
                        className="btn-primary shrink-0"><Copy size={14} /></button>
                    </div>
                  </Field>

                  <Field label="Verify Token" hint="Use this exact value in Meta Developer Console">
                    <div className="flex items-center gap-2">
                      <input readOnly value={account.verify_token}
                        className="input font-mono text-xs" />
                      <button onClick={() => { navigator.clipboard.writeText(account.verify_token); toast.success("Copied!"); }}
                        className="btn-primary shrink-0"><Copy size={14} /></button>
                    </div>
                  </Field>
                </Card>

                <Card title="Setup Steps" icon={Globe} desc="Connect your number in 6 quick steps">
                  <ol className="space-y-2.5">
                    {[
                      'Save your Phone Number ID and Access Token under "Account" tab.',
                      "Go to Meta Developer → Your App → WhatsApp → Configuration.",
                      "Set Callback URL to the URL above.",
                      "Set Verify Token to the value above.",
                      "Subscribe to the messages webhook field.",
                      "Send a message to your WhatsApp business number to test.",
                    ].map((step, i) => (
                      <li key={i} className="flex gap-3 text-xs text-muted-foreground">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              </>
            )}
          </div>
        }
      </div>

      <style>{`
        .input { width: 100%; border-radius: 0.625rem; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); padding: 0.625rem 0.875rem; font-size: 0.875rem; outline: none; transition: all 0.15s ease; }
        .input:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12); }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.625rem 1rem; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 0.625rem; font-size: 0.8125rem; font-weight: 600; transition: all 0.15s ease; box-shadow: 0 1px 2px hsl(var(--primary) / 0.2); }
        .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px hsl(var(--primary) / 0.3); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function Card({
  title, icon: Icon, desc, children, action, accent,
}: {
  title: string; icon: any; desc?: string; children: React.ReactNode;
  action?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border bg-card shadow-sm overflow-hidden ${accent ? "border-primary/30" : "border-border/70"}`}>
      {accent && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              accent ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/25"
                     : "bg-secondary text-foreground/70"
            }`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-tight">{title}</h3>
              {desc && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>}
            </div>
          </div>
          {action}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, icon: Icon, children }: { label: string; hint?: string; icon?: any; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-foreground/80">
        {Icon && <Icon size={12} className="text-muted-foreground" />} {label}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function ToggleBtn({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}