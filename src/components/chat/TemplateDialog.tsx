import { useState, useEffect } from "react";
import { Template, fetchTemplates } from "@/lib/whatsapp";
import { X, Send } from "lucide-react";

interface TemplateDialogProps {
  onClose: () => void;
  onSend: (template: Template) => void;
}

export function TemplateDialog({ onClose, onSend }: TemplateDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Send Template</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading templates...</p>
          ) : templates.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">No templates found</p>
              <p className="text-xs mt-1">Add templates in Settings</p>
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="border border-border rounded-lg p-3 mb-2 hover:bg-secondary/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.language} · {t.category} · {t.status}
                    </p>
                  </div>
                  <button
                    onClick={() => onSend(t)}
                    className="p-2 rounded-full bg-primary text-primary-foreground"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
