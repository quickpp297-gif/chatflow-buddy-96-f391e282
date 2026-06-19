import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Plus, Trash2, Save, Zap, MessageCircle, FileText, Sparkles,
  Tag, TagsIcon, UserPlus, Pencil, Briefcase, Clock, GitBranch, Webhook, X,
  Bell, Users, Database, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import {
  Automation, AutomationAction, AutomationActionType, AutomationTriggerType,
  fetchAutomations, createAutomation, updateAutomation, deleteAutomation,
} from "@/lib/automations";

interface Props { onBack: () => void; }

const ACTION_META: Record<AutomationActionType, { label: string; icon: any; color: string }> = {
  send_message:         { label: "Send Message",          icon: MessageCircle, color: "#3b5bdb" },
  send_template:        { label: "Send Template",         icon: FileText,      color: "#1098ad" },
  ai_reply:             { label: "AI Reply (Claude/GPT/Gemini)", icon: Sparkles,      color: "#7048e8" },
  add_tag:              { label: "Add Tag",               icon: Tag,           color: "#0ca678" },
  remove_tag:           { label: "Remove Tag",            icon: TagsIcon,      color: "#e8590c" },
  assign_conversation:  { label: "Assign Conversation",   icon: UserPlus,      color: "#1c7ed6" },
  update_contact_field: { label: "Update Contact Field",  icon: Pencil,        color: "#f59f00" },
  create_deal:          { label: "Create Deal",           icon: Briefcase,     color: "#7950f2" },
  wait:                 { label: "Wait",                  icon: Clock,         color: "#a78bfa" },
  condition:            { label: "Condition (If/Else)",   icon: GitBranch,     color: "#fab005" },
  send_webhook:         { label: "Send Webhook",          icon: Webhook,       color: "#212529" },
  close_conversation:   { label: "Close Conversation",    icon: X,             color: "#fa5252" },
};

const TRIGGERS: { value: AutomationTriggerType; label: string; desc: string }[] = [
  { value: "new_message",   label: "New Message Received", desc: "Any incoming message" },
  { value: "new_contact",   label: "New Contact",          desc: "First-ever message from a number" },
  { value: "keyword",       label: "Keyword Match",        desc: "Message contains specific keywords" },
  { value: "outside_hours", label: "Outside Business Hours", desc: "Message received off-hours" },
  { value: "no_reply_24h",  label: "No Reply in 24h",      desc: "Contact hasn't replied for 24 hours" },
  { value: "tag_added",     label: "Tag Added",            desc: "When a tag is added to a contact" },
];

function rid() { return Math.random().toString(36).slice(2, 10); }

/* Templates */
const TEMPLATES = [
  { key: "welcome", title: "Welcome Message", icon: MessageSquare,
    desc: "Auto-reply to first-time contacts with a greeting.",
    build: () => ({ name: "Welcome Message", trigger_type: "new_contact" as AutomationTriggerType, trigger_config: {},
      actions: [{ id: rid(), type: "send_message" as AutomationActionType, config: { body: "Hi 👋 Thanks for reaching out! We'll get back to you shortly." } }] }) },
  { key: "office", title: "Out of Office", icon: Clock,
    desc: "Auto-reply during off-hours so nobody is left waiting.",
    build: () => ({ name: "Out of Office", trigger_type: "outside_hours" as AutomationTriggerType,
      trigger_config: { from: "18:00", to: "09:00" },
      actions: [{ id: rid(), type: "send_message" as AutomationActionType, config: { body: "Thanks for your message! Our office is closed. We'll reply in business hours (9am-6pm)." } }] }) },
  { key: "qual", title: "Lead Qualifier", icon: Users,
    desc: "Ask qualification questions to filter inbound leads.",
    build: () => ({ name: "Lead Qualifier", trigger_type: "new_contact" as AutomationTriggerType, trigger_config: {},
      actions: [
        { id: rid(), type: "send_message" as AutomationActionType, config: { body: "Hi! Quick question — what's your monthly revenue range?" } },
        { id: rid(), type: "add_tag" as AutomationActionType, config: { tag: "new-lead" } },
      ] }) },
  { key: "followup", title: "Follow-up Reminder", icon: Bell,
    desc: "Send a nudge if a contact has not replied within 24 hours.",
    build: () => ({ name: "Follow-up Reminder", trigger_type: "no_reply_24h" as AutomationTriggerType, trigger_config: {},
      actions: [{ id: rid(), type: "send_message" as AutomationActionType, config: { body: "Hey, just checking in! Did you get a chance to look at this?" } }] }) },
  { key: "fetch", title: "Fetch User Data from Your App", icon: Database,
    desc: "When customer types 'my orders', call your backend with their phone and reply with their data.",
    build: () => ({ name: "Fetch User Data", trigger_type: "keyword" as AutomationTriggerType,
      trigger_config: { keywords: "my orders, orders, status" },
      actions: [
        { id: rid(), type: "send_webhook" as AutomationActionType, config: { url: "https://your-app.com/api/orders", method: "POST", body: '{"phone":"{{contact.phone}}"}' } },
        { id: rid(), type: "send_message" as AutomationActionType, config: { body: "Here are your recent orders: {{webhook.response}}" } },
      ] }) },
  { key: "ai", title: "AI Auto-Reply (24/7)", icon: Sparkles,
    desc: "Use AI to answer common questions when agents are offline.",
    build: () => ({ name: "AI Auto-Reply (24/7)", trigger_type: "outside_hours" as AutomationTriggerType,
      trigger_config: { from: "18:00", to: "09:00" },
      actions: [{ id: rid(), type: "ai_reply" as AutomationActionType, config: { model: "google/gemini-3-flash-preview", system: "You are a helpful customer support assistant. Keep replies short." } }] }) },
];

export function AutomationsPanel({ onBack }: Props) {
  const { current } = useAccount();
  const { user } = useAuth();
  const [items, setItems] = useState<Automation[]>([]);
  const [active, setActive] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try { setItems(await fetchAutomations(current.id)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [current]);

  useEffect(() => { reload(); }, [reload]);

  if (!current || !user) return null;
  if (active) return <AutomationEditor automation={active} onBack={() => { setActive(null); reload(); }} />;

  const newBlank = async () => {
    try {
      const a = await createAutomation({ account_id: current.id, user_id: user.id });
      setActive(a);
    } catch (e: any) { toast.error(e.message); }
  };

  const useTemplate = async (key: string) => {
    const tpl = TEMPLATES.find((t) => t.key === key); if (!tpl) return;
    try {
      const a = await createAutomation({ account_id: current.id, user_id: user.id, ...tpl.build() });
      setActive(a);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#fbfaf5]">
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--wa-header))] shrink-0">
        <button onClick={onBack} className="text-primary-foreground"><ArrowLeft size={22} /></button>
        <h1 className="text-lg font-bold text-primary-foreground">Automations</h1>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-amber-500 mb-1">BETA</div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Automations</h2>
              <p className="text-muted-foreground mt-2">Build workflows that react to WhatsApp events automatically.</p>
            </div>
            <button onClick={newBlank}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1f1d3a] text-white font-semibold hover:opacity-90 shadow-sm">
              <Plus size={18} /> Create Automation
            </button>
          </div>

          <h3 className="font-semibold mb-3 underline underline-offset-4 decoration-2">Quick-start templates</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => useTemplate(t.key)}
                  className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-amber-600" />
                  </div>
                  <div className="font-bold text-base mb-2">{t.title}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                </button>
              );
            })}
          </div>

          <h3 className="font-semibold mb-3">Your automations</h3>
          {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
           : items.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-card/40">
              <Zap className="mx-auto mb-3 text-muted-foreground" size={32} />
              <p className="font-semibold">No automations yet</p>
              <p className="text-sm text-muted-foreground">Use a template above or build one from scratch.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <div>Name</div><div>Trigger</div><div className="hidden sm:block">Actions</div>
                <div className="hidden sm:block">Runs</div><div>Active</div><div></div>
              </div>
              {items.map((a) => (
                <div key={a.id} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/50">
                  <button onClick={() => setActive(a)} className="text-left font-medium truncate">{a.name}</button>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground font-mono">{a.trigger_type}</span>
                  <span className="hidden sm:block text-xs text-muted-foreground">{a.actions?.length || 0} steps</span>
                  <span className="hidden sm:block text-xs text-muted-foreground">{a.runs_count}</span>
                  <button onClick={async () => { await updateAutomation(a.id, { is_active: !a.is_active }); reload(); }}>
                    <span className={`relative inline-block w-10 h-6 rounded-full transition ${a.is_active ? "bg-primary" : "bg-gray-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${a.is_active ? "translate-x-4" : ""}`} />
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setActive(a)} className="p-1.5 hover:bg-secondary rounded"><Pencil size={14} /></button>
                    <button onClick={async () => { if (confirm("Delete?")) { await deleteAutomation(a.id); reload(); } }}
                      className="text-destructive p-1.5 hover:bg-destructive/10 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ EDITOR ============ */
function AutomationEditor({ automation, onBack }: { automation: Automation; onBack: () => void }) {
  const [name, setName] = useState(automation.name);
  const [trigger, setTrigger] = useState<AutomationTriggerType>(automation.trigger_type);
  const [triggerCfg, setTriggerCfg] = useState<Record<string, any>>(automation.trigger_config || {});
  const [actions, setActions] = useState<AutomationAction[]>(automation.actions || []);
  const [active, setActive] = useState(automation.is_active);
  const [saving, setSaving] = useState(false);
  const [showMenuAt, setShowMenuAt] = useState<number | null>(null);

  const addAt = (idx: number, type: AutomationActionType) => {
    const a: AutomationAction = { id: rid(), type, config: {} };
    setActions((arr) => { const next = [...arr]; next.splice(idx, 0, a); return next; });
    setShowMenuAt(null);
  };
  const patch = (id: string, p: Partial<AutomationAction>) =>
    setActions((arr) => arr.map((a) => a.id === id ? { ...a, ...p } : a));
  const remove = (id: string) => setActions((arr) => arr.filter((a) => a.id !== id));

  const save = async () => {
    setSaving(true);
    try {
      await updateAutomation(automation.id, { name, trigger_type: trigger, trigger_config: triggerCfg, actions, is_active: active });
      toast.success("Automation saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const trigInfo = TRIGGERS.find((t) => t.value === trigger)!;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#fbfaf5]">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={onBack}><ArrowLeft size={22} /></button>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-transparent font-semibold outline-none rounded-lg px-3 py-1.5 hover:bg-secondary focus:bg-secondary" />
        <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-[#1f1d3a] text-white text-xs font-bold">Beta</span>
        <label className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground cursor-pointer" onClick={() => setActive(!active)}>
          Active
          <span className={`relative inline-block w-10 h-6 rounded-full transition ${active ? "bg-primary" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : ""}`} />
          </span>
        </label>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#1f1d3a] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
          <Save size={14} /> {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Trigger card */}
          <div className="bg-card rounded-2xl border-l-4 border-l-primary border border-border p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Zap className="text-blue-600" size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-blue-600 font-bold">Trigger</div>
                <div className="font-bold text-lg">{trigInfo.label}</div>
                <div className="text-xs text-muted-foreground">{trigInfo.desc}</div>
              </div>
            </div>
            <label className="text-sm font-medium">Trigger type</label>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value as any)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {trigger === "keyword" && (
              <div className="mt-3">
                <label className="text-sm font-medium">Keywords (comma separated)</label>
                <input value={triggerCfg.keywords || ""} onChange={(e) => setTriggerCfg({ ...triggerCfg, keywords: e.target.value })}
                  placeholder="my orders, status, help"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
            )}
            {trigger === "outside_hours" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Close at</label>
                  <input type="time" value={triggerCfg.from || "18:00"} onChange={(e) => setTriggerCfg({ ...triggerCfg, from: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></div>
                <div><label className="text-sm font-medium">Open at</label>
                  <input type="time" value={triggerCfg.to || "09:00"} onChange={(e) => setTriggerCfg({ ...triggerCfg, to: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></div>
              </div>
            )}
            {trigger === "tag_added" && (
              <div className="mt-3">
                <label className="text-sm font-medium">Tag</label>
                <input value={triggerCfg.tag || ""} onChange={(e) => setTriggerCfg({ ...triggerCfg, tag: e.target.value })}
                  placeholder="vip"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
            )}
          </div>

          {/* Actions chain */}
          {actions.map((a, idx) => (
            <div key={a.id}>
              <AddRow show={showMenuAt === idx} onToggle={() => setShowMenuAt(showMenuAt === idx ? null : idx)} onAdd={(t) => addAt(idx, t)} />
              <ActionCard action={a} onChange={(p) => patch(a.id, p)} onRemove={() => remove(a.id)} />
            </div>
          ))}
          <AddRow show={showMenuAt === actions.length} onToggle={() => setShowMenuAt(showMenuAt === actions.length ? null : actions.length)} onAdd={(t) => addAt(actions.length, t)} />
        </div>
      </div>
    </div>
  );
}

function AddRow({ show, onToggle, onAdd }: { show: boolean; onToggle: () => void; onAdd: (t: AutomationActionType) => void }) {
  return (
    <div className="flex flex-col items-center my-2">
      <div className="w-px h-4 bg-border" />
      <button onClick={onToggle}
        className="w-10 h-10 rounded-full border-2 border-dashed border-amber-400 bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100">
        {show ? <X size={18} /> : <Plus size={18} />}
      </button>
      <div className="w-px h-4 bg-border" />
      {show && (
        <div className="bg-card border border-border rounded-xl shadow-lg p-1 mt-1 min-w-[260px] z-10">
          {(Object.keys(ACTION_META) as AutomationActionType[]).map((t) => {
            const M = ACTION_META[t]; const Icon = M.icon;
            return (
              <button key={t} onClick={() => onAdd(t)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-left">
                <Icon size={16} style={{ color: M.color }} />
                <span>{M.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionCard({ action, onChange, onRemove }: {
  action: AutomationAction; onChange: (p: Partial<AutomationAction>) => void; onRemove: () => void;
}) {
  const M = ACTION_META[action.type]; const Icon = M.icon;
  const cfg = action.config || {};
  const setCfg = (p: Record<string, any>) => onChange({ config: { ...cfg, ...p } });

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${M.color}15` }}>
          <Icon size={20} style={{ color: M.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: M.color }}>Action</div>
          <div className="font-bold">{M.label}</div>
        </div>
        <button onClick={onRemove} className="text-destructive p-1.5 hover:bg-destructive/10 rounded-lg"><Trash2 size={16} /></button>
      </div>

      {action.type === "send_message" && (
        <textarea rows={3} value={cfg.body || ""} onChange={(e) => setCfg({ body: e.target.value })}
          placeholder="Message text. Variables: {{contact.name}}, {{contact.phone}}"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
      )}
      {action.type === "send_template" && (
        <div className="grid grid-cols-2 gap-2">
          <input value={cfg.name || ""} onChange={(e) => setCfg({ name: e.target.value })} placeholder="template_name"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <input value={cfg.lang || "en_US"} onChange={(e) => setCfg({ lang: e.target.value })} placeholder="en_US"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
      )}
      {action.type === "ai_reply" && (
        <div className="space-y-2">
          <select value={cfg.model || "google/gemini-3-flash-preview"} onChange={(e) => setCfg({ model: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="google/gemini-3-flash-preview">Gemini 3 Flash (fast)</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="openai/gpt-5-mini">GPT-5 Mini</option>
            <option value="openai/gpt-5">GPT-5</option>
          </select>
          <textarea rows={3} value={cfg.system || ""} onChange={(e) => setCfg({ system: e.target.value })}
            placeholder="System prompt — e.g. 'You are a friendly support agent. Keep replies short.'"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
        </div>
      )}
      {(action.type === "add_tag" || action.type === "remove_tag") && (
        <input value={cfg.tag || ""} onChange={(e) => setCfg({ tag: e.target.value })} placeholder="tag-name"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      )}
      {action.type === "assign_conversation" && (
        <input value={cfg.agent_email || ""} onChange={(e) => setCfg({ agent_email: e.target.value })} placeholder="agent@company.com"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      )}
      {action.type === "update_contact_field" && (
        <div className="grid grid-cols-2 gap-2">
          <input value={cfg.field || ""} onChange={(e) => setCfg({ field: e.target.value })} placeholder="field name"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <input value={cfg.value || ""} onChange={(e) => setCfg({ value: e.target.value })} placeholder="value"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
      )}
      {action.type === "create_deal" && (
        <div className="space-y-2">
          <input value={cfg.title || ""} onChange={(e) => setCfg({ title: e.target.value })} placeholder="Deal title"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <input type="number" value={cfg.amount || ""} onChange={(e) => setCfg({ amount: Number(e.target.value) })} placeholder="Amount"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
      )}
      {action.type === "wait" && (
        <div className="flex items-center gap-2 text-sm">
          Wait
          <input type="number" min={1} value={cfg.seconds || 60} onChange={(e) => setCfg({ seconds: Number(e.target.value) })}
            className="w-24 rounded-lg border border-input bg-background px-2 py-2 text-sm" />
          seconds
        </div>
      )}
      {action.type === "condition" && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input value={cfg.field || ""} onChange={(e) => setCfg({ field: e.target.value })} placeholder="message.text"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <select value={cfg.op || "contains"} onChange={(e) => setCfg({ op: e.target.value })}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="contains">contains</option><option value="equals">equals</option>
              <option value="starts_with">starts with</option><option value="regex">regex</option>
            </select>
            <input value={cfg.value || ""} onChange={(e) => setCfg({ value: e.target.value })} placeholder="value"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-muted-foreground">If true, continue. If false, skip the rest of the chain.</p>
        </div>
      )}
      {action.type === "send_webhook" && (
        <div className="space-y-2">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <select value={cfg.method || "POST"} onChange={(e) => setCfg({ method: e.target.value })}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option>POST</option><option>GET</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
            </select>
            <input value={cfg.url || ""} onChange={(e) => setCfg({ url: e.target.value })} placeholder="https://your-app.com/api/endpoint"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <textarea rows={3} value={cfg.body || ""} onChange={(e) => setCfg({ body: e.target.value })}
            placeholder='{"phone":"{{contact.phone}}","message":"{{message.text}}"}'
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none font-mono" />
          <input value={cfg.save_as || ""} onChange={(e) => setCfg({ save_as: e.target.value })} placeholder="Save response as variable (e.g. webhook)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <p className="text-xs text-muted-foreground">Response is stored in <code>{`{{<name>.response}}`}</code> for next actions. The webhook can return JSON that writes to your DB.</p>
        </div>
      )}
      {action.type === "close_conversation" && (
        <p className="text-sm text-muted-foreground">Marks the conversation as resolved and removes it from the open inbox.</p>
      )}
    </div>
  );
}