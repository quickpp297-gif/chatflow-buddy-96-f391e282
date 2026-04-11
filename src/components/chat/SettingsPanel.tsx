import { useState, useEffect } from "react";
import {
  fetchSettings,
  updateSetting,
  fetchAutoReplies,
  upsertAutoReply,
  deleteAutoReply,
  AutoReply,
} from "@/lib/whatsapp";
import { ArrowLeft, Save, Plus, Trash2, ToggleLeft, ToggleRight, Globe } from "lucide-react";
import { toast } from "sonner";

interface SettingsPanelProps {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "auto" | "webhook">("general");

  // New keyword reply form
  const [newKeyword, setNewKeyword] = useState("");
  const [newReply, setNewReply] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [s, ar] = await Promise.all([fetchSettings(), fetchAutoReplies()]);
      setSettings(s);
      setAutoReplies(ar);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      await updateSetting(key, value);
      setSettings((prev) => ({ ...prev, [key]: value }));
      toast.success("Setting saved");
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    }
  };

  const handleToggleAway = async () => {
    const newVal = settings.away_mode === "true" ? "false" : "true";
    await handleSaveSetting("away_mode", newVal);
    // Toggle away auto-reply
    const awayReply = autoReplies.find((r) => r.trigger_type === "away");
    if (awayReply) {
      await upsertAutoReply({ id: awayReply.id, is_active: newVal === "true" });
      loadData();
    }
  };

  const handleAddKeywordReply = async () => {
    if (!newKeyword.trim() || !newReply.trim()) return;
    try {
      await upsertAutoReply({
        trigger_type: "keyword",
        trigger_keyword: newKeyword.trim(),
        reply_message: newReply.trim(),
        is_active: true,
      });
      setNewKeyword("");
      setNewReply("");
      loadData();
      toast.success("Auto reply added");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteReply = async (id: string) => {
    try {
      await deleteAutoReply(id);
      loadData();
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleReply = async (reply: AutoReply) => {
    await upsertAutoReply({ id: reply.id, is_active: !reply.is_active });
    loadData();
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const tabs = [
    { id: "general" as const, label: "General" },
    { id: "auto" as const, label: "Auto Reply" },
    { id: "webhook" as const, label: "Webhook" },
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 bg-primary shrink-0">
        <button onClick={onBack} className="text-primary-foreground">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-primary-foreground">Settings</h1>
      </div>

      <div className="flex border-b border-border shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === "general" && (
          <div className="space-y-6 max-w-lg mx-auto">
            <div>
              <label className="text-sm font-medium mb-1 block">Welcome Message</label>
              <textarea
                value={settings.welcome_message || ""}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, welcome_message: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
              />
              <button
                onClick={() => handleSaveSetting("welcome_message", settings.welcome_message || "")}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm"
              >
                <Save size={14} /> Save
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Away Mode</label>
                <button onClick={handleToggleAway} className="text-primary">
                  {settings.away_mode === "true" ? (
                    <ToggleRight size={28} />
                  ) : (
                    <ToggleLeft size={28} className="text-muted-foreground" />
                  )}
                </button>
              </div>
              <textarea
                value={settings.away_message || ""}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, away_message: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
              />
              <button
                onClick={() => handleSaveSetting("away_message", settings.away_message || "")}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm"
              >
                <Save size={14} /> Save
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Auto Reply Enabled</label>
              <button
                onClick={() =>
                  handleSaveSetting(
                    "auto_reply_enabled",
                    settings.auto_reply_enabled === "true" ? "false" : "true"
                  )
                }
                className="text-primary"
              >
                {settings.auto_reply_enabled === "true" ? (
                  <ToggleRight size={28} />
                ) : (
                  <ToggleLeft size={28} className="text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === "auto" && (
          <div className="space-y-4 max-w-lg mx-auto">
            <h3 className="font-medium text-sm">Keyword Auto Replies</h3>

            {autoReplies
              .filter((r) => r.trigger_type === "keyword")
              .map((reply) => (
                <div key={reply.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      Keyword: <span className="text-primary">{reply.trigger_keyword}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleReply(reply)}>
                        {reply.is_active ? (
                          <ToggleRight size={22} className="text-primary" />
                        ) : (
                          <ToggleLeft size={22} className="text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        className="text-destructive"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{reply.reply_message}</p>
                </div>
              ))}

            <div className="border border-dashed border-border rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2">Add New Keyword Reply</h4>
              <input
                type="text"
                placeholder="Trigger keyword"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-2"
              />
              <textarea
                placeholder="Reply message"
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none mb-2"
              />
              <button
                onClick={handleAddKeywordReply}
                disabled={!newKeyword.trim() || !newReply.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            <h3 className="font-medium text-sm mt-6">System Auto Replies</h3>
            {autoReplies
              .filter((r) => r.trigger_type !== "keyword")
              .map((reply) => (
                <div key={reply.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{reply.trigger_type}</span>
                    <button onClick={() => handleToggleReply(reply)}>
                      {reply.is_active ? (
                        <ToggleRight size={22} className="text-primary" />
                      ) : (
                        <ToggleLeft size={22} className="text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">{reply.reply_message}</p>
                </div>
              ))}
          </div>
        )}

        {activeTab === "webhook" && (
          <div className="space-y-4 max-w-lg mx-auto">
            <div>
              <label className="text-sm font-medium mb-1 block">Webhook URL</label>
              <p className="text-xs text-muted-foreground mb-2">
                Copy this URL and paste it in your Facebook Developer App → WhatsApp → Configuration → Callback URL
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success("Copied!");
                  }}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Verify Token</label>
              <p className="text-xs text-muted-foreground mb-2">
                Use this verify token in your Facebook Developer webhook configuration. You set this via the WEBHOOK_VERIFY_TOKEN secret.
              </p>
              <input
                type="text"
                readOnly
                value="(Set in secrets as WEBHOOK_VERIFY_TOKEN)"
                className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Subscribed Fields</label>
              <p className="text-xs text-muted-foreground mb-2">
                Make sure to subscribe to these webhook fields in Facebook Developer:
              </p>
              <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                <li>messages</li>
              </ul>
            </div>

            <div className="bg-accent/50 rounded-lg p-4">
              <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                <Globe size={16} /> Setup Instructions
              </h4>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal ml-4">
                <li>Go to Facebook Developer Portal → Your App → WhatsApp → Configuration</li>
                <li>Set the Callback URL to the webhook URL above</li>
                <li>Set the Verify Token to match your WEBHOOK_VERIFY_TOKEN secret</li>
                <li>Subscribe to "messages" webhook field</li>
                <li>Add your WhatsApp phone number ID and token as secrets (WHATSAPP_PHONE_ID, WHATSAPP_TOKEN)</li>
                <li>Test by sending a message to your WhatsApp number</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
