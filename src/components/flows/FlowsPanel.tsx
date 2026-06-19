import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Plus, Trash2, Save, MessageCircle, MousePointerClick,
  HelpCircle, Image as ImageIcon, FileText, Clock, UserPlus, StopCircle,
  Workflow, MessageSquare, UserPlus2,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import {
  Flow, FlowNode, FlowNodeType, fetchFlows, createFlow, updateFlow, deleteFlow,
} from "@/lib/flows";

interface Props { onBack: () => void; }

const NODE_META: Record<FlowNodeType, { label: string; icon: any; color: string }> = {
  message:  { label: "Send message",     icon: MessageCircle,      color: "#3b5bdb" },
  buttons:  { label: "Buttons menu",     icon: MousePointerClick,  color: "#7048e8" },
  ask:      { label: "Ask question",     icon: HelpCircle,         color: "#f59f00" },
  media:    { label: "Send media",       icon: ImageIcon,          color: "#0ca678" },
  template: { label: "Send template",    icon: FileText,           color: "#1098ad" },
  delay:    { label: "Wait / delay",     icon: Clock,              color: "#a78bfa" },
  handover: { label: "Handover to human",icon: UserPlus,           color: "#e8590c" },
  end:      { label: "End flow",         icon: StopCircle,         color: "#868e96" },
};

function rid() { return Math.random().toString(36).slice(2, 10); }

function summarize(n: FlowNode): string {
  if (n.type === "message")  return n.body?.slice(0, 60) || "(empty)";
  if (n.type === "ask")      return n.body?.slice(0, 60) || "(question)";
  if (n.type === "buttons")  return `${n.buttons?.length || 0} buttons`;
  if (n.type === "media")    return `${n.media_kind || "image"} • ${n.media_url ? "set" : "no url"}`;
  if (n.type === "template") return n.template_name || "(template)";
  if (n.type === "delay")    return `${n.delay_seconds ?? 5}s`;
  if (n.type === "handover") return "Hand off to agent";
  return "End";
}

/* -------- Quick start templates -------- */
const TEMPLATES: { key: string; title: string; desc: string; icon: any; build: () => Pick<Flow, "name" | "trigger_type" | "trigger_value" | "nodes"> }[] = [
  {
    key: "welcome", title: "Welcome menu", icon: MessageSquare,
    desc: "Greet customers who type a keyword and route them to the right agent based on whether they're new or existing.",
    build: () => {
      const m = rid(), b = rid(), h1 = rid(), h2 = rid();
      return {
        name: "Welcome menu", trigger_type: "keyword", trigger_value: "hi, hello, menu",
        nodes: [
          { id: m, type: "message", is_start: true, body: "Hi 👋 Welcome! How can we help you today?", next: b },
          { id: b, type: "buttons", body: "Pick an option:", buttons: [
            { id: rid(), label: "I'm new", next: h1 },
            { id: rid(), label: "Existing customer", next: h2 },
          ]},
          { id: h1, type: "handover" },
          { id: h2, type: "handover" },
        ],
      };
    },
  },
  {
    key: "faq", title: "FAQ bot", icon: HelpCircle,
    desc: "Answer common questions automatically. Customer picks a topic from a list; the bot replies with the answer and ends.",
    build: () => {
      const intro = rid(), menu = rid(), a1 = rid(), a2 = rid(), a3 = rid(), e1 = rid(), e2 = rid(), e3 = rid();
      return {
        name: "FAQ bot", trigger_type: "keyword", trigger_value: "faq, help, support",
        nodes: [
          { id: intro, type: "message", is_start: true, body: "Hi! I'm the FAQ bot. Pick a topic 👇", next: menu },
          { id: menu, type: "buttons", body: "Topics:", buttons: [
            { id: rid(), label: "Pricing", next: a1 },
            { id: rid(), label: "Shipping", next: a2 },
            { id: rid(), label: "Returns", next: a3 },
          ]},
          { id: a1, type: "message", body: "Our pricing starts at $X / month. Visit example.com/pricing.", next: e1 },
          { id: a2, type: "message", body: "We ship worldwide in 3-7 days.", next: e2 },
          { id: a3, type: "message", body: "Free returns within 30 days.", next: e3 },
          { id: e1, type: "end" }, { id: e2, type: "end" }, { id: e3, type: "end" },
        ],
      };
    },
  },
  {
    key: "lead", title: "Lead capture", icon: UserPlus2,
    desc: "Greet first-time inbounds, capture name + email + company, then hand off to sales with the answers in the note.",
    build: () => {
      const g = rid(), q1 = rid(), q2 = rid(), q3 = rid(), t = rid(), h = rid();
      return {
        name: "Lead capture", trigger_type: "new_contact", trigger_value: null,
        nodes: [
          { id: g, type: "message", is_start: true, body: "Hi 👋 thanks for reaching out! A few quick questions:", next: q1 },
          { id: q1, type: "ask", body: "What's your full name?", save_as: "lead_name", next: q2 },
          { id: q2, type: "ask", body: "Your email?", save_as: "lead_email", next: q3 },
          { id: q3, type: "ask", body: "Company name?", save_as: "lead_company", next: t },
          { id: t, type: "message", body: "Thanks {{lead_name}}! Connecting you to our sales team now.", next: h },
          { id: h, type: "handover" },
        ],
      };
    },
  },
];

/* ============ MAIN PANEL ============ */
export function FlowsPanel({ onBack }: Props) {
  const { current } = useAccount();
  const { user } = useAuth();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [active, setActive] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try { setFlows(await fetchFlows(current.id)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [current]);

  useEffect(() => { reload(); }, [reload]);

  if (!current || !user) return null;
  if (active) return <FlowEditor flow={active} onBack={() => { setActive(null); reload(); }} />;

  const newBlank = async () => {
    try {
      const id = rid();
      const f = await createFlow({
        account_id: current.id, user_id: user.id,
        name: "Untitled flow", flow_type: "visual",
        trigger_type: "keyword", trigger_value: null,
        nodes: [{ id, type: "message", is_start: true, body: "Hello!" }],
      });
      setActive(f);
    } catch (e: any) { toast.error(e.message); }
  };

  const useTemplate = async (key: string) => {
    const tpl = TEMPLATES.find(t => t.key === key); if (!tpl) return;
    const built = tpl.build();
    try {
      const f = await createFlow({
        account_id: current.id, user_id: user.id, flow_type: "visual",
        ...built,
      });
      setActive(f);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#fbfaf5]">
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--wa-header))] shrink-0">
        <button onClick={onBack} className="text-primary-foreground"><ArrowLeft size={22} /></button>
        <h1 className="text-lg font-bold text-primary-foreground">Flows</h1>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div className="min-w-0">
              <div className="text-xs font-bold tracking-[0.2em] text-amber-500 mb-1">BETA</div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Flows</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Build branching, button-driven WhatsApp conversations. Useful for menus, FAQs,
                and triage before a human steps in.
              </p>
            </div>
            <button onClick={newBlank}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1f1d3a] text-white font-semibold hover:opacity-90 shadow-sm">
              <Plus size={18} /> Create flow
            </button>
          </div>

          <h3 className="font-semibold mb-3 underline underline-offset-4 decoration-2">Quick-start templates</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              const nodeCount = t.build().nodes.length;
              return (
                <button key={t.key} onClick={() => useTemplate(t.key)}
                  className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition group">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-amber-600" />
                  </div>
                  <div className="font-bold text-base mb-2">{t.title}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                  <div className="text-xs text-muted-foreground mt-4">{nodeCount} nodes</div>
                </button>
              );
            })}
          </div>

          <h3 className="font-semibold mb-3">Your flows</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : flows.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-card/40">
              <MessageCircle className="mx-auto mb-3 text-muted-foreground" size={32} />
              <p className="font-semibold">No flows yet</p>
              <p className="text-sm text-muted-foreground">Pick a template above or create one from scratch.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {flows.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition">
                  <button onClick={() => setActive(f)} className="flex-1 text-left min-w-0">
                    <div className="font-semibold truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {f.trigger_type === "keyword" ? `Keyword: ${f.trigger_value || "—"}` :
                       f.trigger_type === "new_contact" ? "First contact message" : "Any message"}
                      {" · "}{(f.nodes?.length || 0)} nodes
                    </div>
                  </button>
                  <span className={`text-xs px-2 py-1 rounded-full ${f.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {f.is_active ? "Active" : "Off"}
                  </span>
                  <button onClick={async () => { if (confirm("Delete this flow?")) { await deleteFlow(f.id); reload(); } }}
                    className="text-destructive p-1.5 hover:bg-destructive/10 rounded-lg"><Trash2 size={16} /></button>
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
function FlowEditor({ flow, onBack }: { flow: Flow; onBack: () => void }) {
  const [name, setName] = useState(flow.name);
  const [trigger, setTrigger] = useState(flow.trigger_type);
  const [triggerValue, setTriggerValue] = useState(flow.trigger_value || "");
  const [active, setActive] = useState(flow.is_active);
  const [nodes, setNodes] = useState<FlowNode[]>(() => {
    const list = (flow.nodes && flow.nodes.length ? flow.nodes : [{ id: rid(), type: "message" as FlowNodeType, is_start: true, body: "Hello!" }]) as FlowNode[];
    if (!list.some((n) => n.is_start)) list[0].is_start = true;
    return list;
  });
  const [selectedId, setSelectedId] = useState<string>(nodes[0].id);
  const [saving, setSaving] = useState(false);

  const selected = nodes.find((n) => n.id === selectedId) || nodes[0];

  const patchNode = (id: string, p: Partial<FlowNode>) =>
    setNodes((arr) => arr.map((n) => n.id === id ? { ...n, ...p } : n));

  const addNode = (type: FlowNodeType) => {
    const id = rid();
    const base: FlowNode = { id, type };
    if (type === "buttons") base.buttons = [{ id: rid(), label: "Option 1" }];
    if (type === "delay")  base.delay_seconds = 5;
    if (type === "media")  base.media_kind = "image";
    setNodes((arr) => [...arr, base]);
    setSelectedId(id);
  };

  const removeNode = (id: string) => {
    if (nodes.length === 1) { toast.error("Flow needs at least one node"); return; }
    setNodes((arr) => {
      const next = arr.filter((n) => n.id !== id).map((n) => {
        const updated = { ...n };
        if (updated.next === id) updated.next = undefined;
        if (updated.buttons) updated.buttons = updated.buttons.map((b) => b.next === id ? { ...b, next: undefined } : b);
        return updated;
      });
      if (!next.some((n) => n.is_start)) next[0].is_start = true;
      setSelectedId(next[0].id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateFlow(flow.id, {
        name, trigger_type: trigger,
        trigger_value: triggerValue || null,
        is_active: active,
        nodes,
      });
      toast.success("Flow saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const otherNodes = nodes.filter((n) => n.id !== selected.id);

  return (
    <div className="h-[100dvh] flex flex-col bg-[#fbfaf5]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={onBack} className="text-foreground"><ArrowLeft size={22} /></button>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-transparent text-foreground font-semibold outline-none rounded-lg px-3 py-1.5 hover:bg-secondary focus:bg-secondary text-sm sm:text-base" />
        <label className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          Active
          <span className={`relative inline-block w-10 h-6 rounded-full transition ${active ? "bg-primary" : "bg-gray-300"}`}
            onClick={() => setActive(!active)}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : ""}`} />
          </span>
        </label>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#1f1d3a] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
          <Save size={14} /> {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto custom-scrollbar p-4 space-y-5">
          <div>
            <label className="text-sm font-semibold">Trigger keyword</label>
            <input value={triggerValue} onChange={(e) => { setTriggerValue(e.target.value); setTrigger("keyword"); }}
              placeholder="e.g. hello"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <label className="mt-3 flex items-center gap-3 cursor-pointer text-sm" onClick={() => setTrigger(trigger === "new_contact" ? "keyword" : "new_contact")}>
              <span className={`relative inline-block w-10 h-6 rounded-full transition ${trigger === "new_contact" ? "bg-primary" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${trigger === "new_contact" ? "translate-x-4" : ""}`} />
              </span>
              <span>Trigger on first contact message</span>
            </label>
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Nodes</div>
            <div className="space-y-1">
              {nodes.map((n) => {
                const M = NODE_META[n.type]; const Icon = M.icon;
                const isSel = n.id === selected.id;
                return (
                  <button key={n.id} onClick={() => setSelectedId(n.id)}
                    className={`w-full flex items-start gap-2 p-2 rounded-lg text-left border transition ${isSel ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary"}`}>
                    <Icon size={16} className="mt-0.5 shrink-0" style={{ color: M.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{summarize(n)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {M.label}{n.is_start ? " • START" : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Add node</div>
            <div className="space-y-1.5">
              {(Object.keys(NODE_META) as FlowNodeType[]).map((t) => {
                const M = NODE_META[t]; const Icon = M.icon;
                return (
                  <button key={t} onClick={() => addNode(t)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary hover:bg-secondary text-sm">
                    <Icon size={14} style={{ color: M.color }} /> {M.label}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Editor canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-br from-[#fbfaf5] to-[#fff4e0]">
          <div className="max-w-2xl mx-auto">
            <NodeEditor node={selected} all={otherNodes} onChange={(p) => patchNode(selected.id, p)} onDelete={() => removeNode(selected.id)} onSetStart={() => {
              setNodes((arr) => arr.map((n) => ({ ...n, is_start: n.id === selected.id })));
            }} />
          </div>
        </main>
      </div>
    </div>
  );
}

function NodeEditor({ node, all, onChange, onDelete, onSetStart }: {
  node: FlowNode; all: FlowNode[];
  onChange: (p: Partial<FlowNode>) => void;
  onDelete: () => void; onSetStart: () => void;
}) {
  const M = NODE_META[node.type];
  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-semibold" style={{ background: "#1f1d3a" }}>
          {M.label}
        </span>
        {node.is_start
          ? <span className="inline-block px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-xs font-bold">START</span>
          : <button onClick={onSetStart} className="text-xs underline text-muted-foreground">Set as start</button>}
        <button onClick={onDelete} className="ml-auto text-destructive p-1.5 hover:bg-destructive/10 rounded-lg"><Trash2 size={16} /></button>
      </div>

      {(node.type === "message" || node.type === "ask") && (
        <div className="space-y-2">
          <label className="text-sm font-medium">{node.type === "ask" ? "Question" : "Message body"}</label>
          <textarea rows={4} value={node.body || ""} onChange={(e) => onChange({ body: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
          <p className="text-xs text-muted-foreground">Variables: <code>{"{{contact.name}}"}</code>, <code>{"{{lead_name}}"}</code> (if saved earlier in ask nodes)</p>
          {node.type === "ask" && (
            <div>
              <label className="text-sm font-medium">Save answer as</label>
              <input value={node.save_as || ""} onChange={(e) => onChange({ save_as: e.target.value })}
                placeholder="e.g. lead_name"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}
        </div>
      )}

      {node.type === "buttons" && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Prompt</label>
          <textarea rows={2} value={node.body || ""} onChange={(e) => onChange({ body: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
          <label className="text-sm font-medium block">Buttons (max 3)</label>
          {(node.buttons || []).map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <input value={b.label} onChange={(e) => onChange({ buttons: node.buttons!.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) })}
                placeholder="Button label" maxLength={20}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <select value={b.next || ""} onChange={(e) => onChange({ buttons: node.buttons!.map((x, idx) => idx === i ? { ...x, next: e.target.value || undefined } : x) })}
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm max-w-[170px]">
                <option value="">(end flow)</option>
                {all.map((n) => <option key={n.id} value={n.id}>→ {summarize(n)}</option>)}
              </select>
              <button onClick={() => onChange({ buttons: node.buttons!.filter((_, idx) => idx !== i) })} className="text-destructive p-1.5"><Trash2 size={14} /></button>
            </div>
          ))}
          {(node.buttons?.length || 0) < 3 && (
            <button onClick={() => onChange({ buttons: [...(node.buttons || []), { id: rid(), label: `Option ${(node.buttons?.length || 0) + 1}` }] })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-sm hover:border-primary">
              <Plus size={12} /> Add button
            </button>
          )}
        </div>
      )}

      {node.type === "media" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select value={node.media_kind || "image"} onChange={(e) => onChange({ media_kind: e.target.value as any })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="image">Image</option><option value="video">Video</option>
            <option value="document">Document</option><option value="audio">Audio</option>
          </select>
          <label className="text-sm font-medium">Media URL</label>
          <input value={node.media_url || ""} onChange={(e) => onChange({ media_url: e.target.value })}
            placeholder="https://..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <label className="text-sm font-medium">Caption (optional)</label>
          <input value={node.caption || ""} onChange={(e) => onChange({ caption: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
      )}

      {node.type === "template" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Template name</label>
          <input value={node.template_name || ""} onChange={(e) => onChange({ template_name: e.target.value })}
            placeholder="e.g. order_confirmation"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <label className="text-sm font-medium">Language</label>
          <input value={node.template_lang || "en_US"} onChange={(e) => onChange({ template_lang: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
      )}

      {node.type === "delay" && (
        <div className="flex items-center gap-2 text-sm">
          Wait
          <input type="number" min={1} value={node.delay_seconds || 5}
            onChange={(e) => onChange({ delay_seconds: Number(e.target.value) })}
            className="w-24 rounded-lg border border-input bg-background px-2 py-2 text-sm" />
          seconds before the next node
        </div>
      )}

      {node.type === "handover" && (
        <p className="text-sm text-muted-foreground">This node pauses the bot and hands the conversation to a human agent. No further nodes will run.</p>
      )}

      {node.type === "end" && (
        <p className="text-sm text-muted-foreground">This ends the flow. The contact stays in the inbox like any other conversation.</p>
      )}

      {node.type !== "buttons" && node.type !== "handover" && node.type !== "end" && (
        <div className="mt-6 border-t border-border pt-4">
          <label className="text-sm font-medium">Next node</label>
          <select value={node.next || ""} onChange={(e) => onChange({ next: e.target.value || undefined })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">(end flow)</option>
            {all.map((n) => <option key={n.id} value={n.id}>→ {summarize(n)}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}