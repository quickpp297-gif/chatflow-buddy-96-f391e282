import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Connection, Edge, Node, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft, Plus, Trash2, Save, Zap, MessageCircle, GitBranch, Clock,
  Send, Workflow, ListOrdered, Code2, ToggleLeft, ToggleRight, Image as ImageIcon, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { Flow, fetchFlows, createFlow, updateFlow, deleteFlow, FlowStep } from "@/lib/flows";

interface Props { onBack: () => void; }

const TRIGGER_LABELS: Record<string, string> = {
  keyword: "Keyword match",
  new_contact: "New contact",
  any_message: "Any message",
  manual: "Manual / API",
};

const NODE_TEMPLATES = [
  { type: "trigger",   label: "Trigger",     icon: Zap,           color: "#25d366" },
  { type: "message",   label: "Send Message",icon: MessageCircle, color: "#3b82f6" },
  { type: "condition", label: "Condition",   icon: GitBranch,     color: "#eab308" },
  { type: "delay",     label: "Delay",       icon: Clock,         color: "#a78bfa" },
  { type: "action",    label: "Action",      icon: Send,          color: "#ec4899" },
];

function newId() { return Math.random().toString(36).slice(2, 10); }

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

  if (active) {
    return <FlowEditor flow={active} onBack={() => { setActive(null); reload(); }} />;
  }

  const newFlow = async (type: Flow["flow_type"]) => {
    try {
      const f = await createFlow({
        account_id: current.id, user_id: user.id,
        name: type === "visual" ? "Untitled Flow" : type === "sequence" ? "New Sequence" : "Meta Flow",
        flow_type: type,
      });
      setActive(f);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--wa-header))] shrink-0">
        <button onClick={onBack} className="text-primary-foreground"><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-primary-foreground">Flows</h1>
          <p className="text-[11px] text-primary-foreground/70">Automate conversations — visual, sequences & Meta Flows</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <button onClick={() => newFlow("visual")}
              className="group rounded-2xl border border-border bg-card p-4 text-left hover:border-primary hover:shadow-md transition">
              <Workflow className="text-primary mb-2" />
              <div className="font-semibold text-sm">Visual Flow</div>
              <p className="text-xs text-muted-foreground mt-1">Drag-drop nodes: trigger → message → condition → action.</p>
            </button>
            <button onClick={() => newFlow("sequence")}
              className="group rounded-2xl border border-border bg-card p-4 text-left hover:border-primary hover:shadow-md transition">
              <ListOrdered className="text-primary mb-2" />
              <div className="font-semibold text-sm">Sequence</div>
              <p className="text-xs text-muted-foreground mt-1">Linear step list: message → delay → message.</p>
            </button>
            <button onClick={() => newFlow("meta")}
              className="group rounded-2xl border border-border bg-card p-4 text-left hover:border-primary hover:shadow-md transition">
              <Code2 className="text-primary mb-2" />
              <div className="font-semibold text-sm">Meta Flow (JSON)</div>
              <p className="text-xs text-muted-foreground mt-1">Official WhatsApp Flows — forms inside WhatsApp.</p>
            </button>
          </div>

          <h3 className="text-sm font-semibold mb-2">Your flows</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : flows.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Workflow className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No flows yet — create your first above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {flows.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition">
                  <button onClick={() => setActive(f)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground uppercase tracking-wider">{f.flow_type}</span>
                      <div className="font-semibold text-sm truncate">{f.name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      Trigger: {TRIGGER_LABELS[f.trigger_type]}{f.trigger_value ? ` · "${f.trigger_value}"` : ""}
                    </div>
                  </button>
                  <button
                    onClick={async () => { await updateFlow(f.id, { is_active: !f.is_active }); reload(); }}
                    className={f.is_active ? "text-primary" : "text-muted-foreground"} title="Toggle active">
                    {f.is_active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>
                  <button onClick={async () => {
                    if (!confirm("Delete this flow?")) return;
                    await deleteFlow(f.id); reload();
                  }} className="text-destructive p-1.5 hover:bg-destructive/10 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------- Editor -------------- */
function FlowEditor({ flow, onBack }: { flow: Flow; onBack: () => void }) {
  const [name, setName] = useState(flow.name);
  const [trigger, setTrigger] = useState(flow.trigger_type);
  const [triggerValue, setTriggerValue] = useState(flow.trigger_value || "");
  const [active, setActive] = useState(flow.is_active);
  const [saving, setSaving] = useState(false);

  /* Visual */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    (flow.nodes as Node[])?.length ? (flow.nodes as Node[]) : [
      { id: "trigger-1", type: "input", position: { x: 60, y: 80 },
        data: { label: "▶  Trigger" },
        style: { background: "#25d366", color: "#0b141a", borderRadius: 12, padding: 10, border: "none", fontWeight: 600 } },
    ]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>((flow.edges as Edge[]) || []);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const addNode = (tpl: typeof NODE_TEMPLATES[number]) => {
    const id = `${tpl.type}-${newId()}`;
    setNodes((nds) => nds.concat({
      id, position: { x: 280 + Math.random() * 100, y: 80 + nds.length * 90 },
      data: { label: `${tpl.label}` },
      style: { background: tpl.color, color: "#0b141a", borderRadius: 12, padding: 10, border: "none", fontWeight: 600 },
    }));
  };

  /* Sequence */
  const [steps, setSteps] = useState<FlowStep[]>(flow.steps || []);
  const addStep = (type: FlowStep["type"]) => {
    setSteps((s) => [...s, { id: newId(), type, content: "", delay_seconds: type === "delay" ? 5 : undefined }]);
  };
  const updateStep = (id: string, patch: Partial<FlowStep>) =>
    setSteps((s) => s.map((x) => x.id === id ? { ...x, ...patch } : x));
  const removeStep = (id: string) => setSteps((s) => s.filter((x) => x.id !== id));

  /* Meta */
  const [metaJson, setMetaJson] = useState<string>(
    flow.meta_flow_json ? JSON.stringify(flow.meta_flow_json, null, 2) : JSON.stringify(SAMPLE_META, null, 2)
  );
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const patch: any = {
        name, trigger_type: trigger,
        trigger_value: triggerValue || null,
        is_active: active,
      };
      if (flow.flow_type === "visual") { patch.nodes = nodes; patch.edges = edges; }
      if (flow.flow_type === "sequence") { patch.steps = steps; }
      if (flow.flow_type === "meta") {
        try { patch.meta_flow_json = JSON.parse(metaJson); setJsonErr(null); }
        catch (e: any) { setJsonErr(e.message); throw new Error("Invalid JSON"); }
      }
      await updateFlow(flow.id, patch);
      toast.success("Flow saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--wa-header))] shrink-0">
        <button onClick={onBack} className="text-primary-foreground"><ArrowLeft size={22} /></button>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-transparent text-primary-foreground font-bold outline-none placeholder-primary-foreground/60" />
        <button onClick={() => setActive(!active)}
          className="text-primary-foreground/90 hover:text-primary-foreground"
          title={active ? "Active" : "Inactive"}>
          {active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
        </button>
        <button onClick={save} disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-primary-foreground text-primary text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-60">
          <Save size={14} /> {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Trigger bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Trigger</span>
        <select value={trigger} onChange={(e) => setTrigger(e.target.value as any)}
          className="text-sm rounded-lg border border-input bg-background px-2 py-1.5">
          {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {trigger === "keyword" && (
          <input value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)}
            placeholder="e.g. price, hi, menu (comma separated)"
            className="text-sm rounded-lg border border-input bg-background px-3 py-1.5 flex-1 min-w-[180px]" />
        )}
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground uppercase tracking-wider">{flow.flow_type}</span>
      </div>

      {/* Body */}
      {flow.flow_type === "visual" && (
        <div className="flex-1 flex min-h-0">
          <div className="w-44 shrink-0 border-r border-border bg-card p-3 space-y-2 overflow-y-auto">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Add node</p>
            {NODE_TEMPLATES.filter(n => n.type !== "trigger").map((tpl) => {
              const Icon = tpl.icon;
              return (
                <button key={tpl.type} onClick={() => addNode(tpl)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary hover:bg-secondary text-sm">
                  <Icon size={14} style={{ color: tpl.color }} /> {tpl.label}
                </button>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-3 leading-relaxed">
              Tip: drag from a node's edge to connect. Click + drag canvas to pan.
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} fitView
              defaultEdgeOptions={{ animated: true, markerEnd: { type: MarkerType.ArrowClosed } }}
            >
              <Background gap={20} />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        </div>
      )}

      {flow.flow_type === "sequence" && (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-3">
            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No steps yet. Add one below.</p>
            )}
            {steps.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary">{i + 1}</span>
                  <StepIcon type={s.type} />
                  <span className="text-sm font-medium capitalize">{s.type}</span>
                  <button onClick={() => removeStep(s.id)} className="ml-auto text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
                {(s.type === "message" || s.type === "image" || s.type === "template" || s.type === "tag") && (
                  <textarea rows={2} value={s.content || ""} onChange={(e) => updateStep(s.id, { content: e.target.value })}
                    placeholder={
                      s.type === "image" ? "Caption (optional)" :
                      s.type === "template" ? "Template name" :
                      s.type === "tag" ? "Tag name" : "Message text"
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
                )}
                {s.type === "image" && (
                  <input value={s.media_url || ""} onChange={(e) => updateStep(s.id, { media_url: e.target.value })}
                    placeholder="Image URL" className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                )}
                {s.type === "delay" && (
                  <div className="flex items-center gap-2 text-sm">
                    Wait
                    <input type="number" min={1} value={s.delay_seconds || 0}
                      onChange={(e) => updateStep(s.id, { delay_seconds: Number(e.target.value) })}
                      className="w-24 rounded-lg border border-input bg-background px-2 py-1.5 text-sm" />
                    seconds
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-2">
              {(["message","image","template","delay","tag"] as FlowStep["type"][]).map((t) => (
                <button key={t} onClick={() => addStep(t)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-sm hover:border-primary capitalize">
                  <Plus size={12} /> {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {flow.flow_type === "meta" && (
        <div className="flex-1 flex flex-col min-h-0">
          {jsonErr && <div className="px-4 py-2 text-xs bg-destructive/10 text-destructive border-b border-destructive/20">{jsonErr}</div>}
          <textarea value={metaJson} onChange={(e) => setMetaJson(e.target.value)}
            className="flex-1 w-full font-mono text-xs p-4 bg-[#0b141a] text-[#25d366] outline-none resize-none"
            spellCheck={false} />
        </div>
      )}
    </div>
  );
}

function StepIcon({ type }: { type: FlowStep["type"] }) {
  const c = "text-primary";
  if (type === "message") return <MessageCircle size={14} className={c} />;
  if (type === "image") return <ImageIcon size={14} className={c} />;
  if (type === "template") return <Send size={14} className={c} />;
  if (type === "delay") return <Clock size={14} className={c} />;
  if (type === "tag") return <Tag size={14} className={c} />;
  return null;
}

const SAMPLE_META = {
  version: "5.0",
  screens: [
    {
      id: "WELCOME",
      title: "Welcome",
      terminal: true,
      data: {},
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextHeading", text: "Hello 👋" },
          { type: "TextBody", text: "Tell us a bit about you." },
          { type: "TextInput", name: "fullName", label: "Full Name", required: true },
          { type: "Footer", label: "Continue", "on-click-action": { name: "complete", payload: {} } }
        ]
      }
    }
  ]
};