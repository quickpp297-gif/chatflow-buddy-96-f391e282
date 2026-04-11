import { useState, useRef, useEffect } from "react";
import {
  Contact,
  Message,
  isWindowOpen,
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  fetchTemplates,
  Template,
} from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Image,
  FileText,
  Video,
  Clock,
  Check,
  CheckCheck,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
import { TemplateDialog } from "./TemplateDialog";

interface ChatAreaProps {
  contact: Contact;
  messages: Message[];
  onBack: () => void;
  onMessageSent: () => void;
}

export function ChatArea({ contact, messages, onBack, onMessageSent }: ChatAreaProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const windowOpen = isWindowOpen(contact);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    if (!windowOpen) {
      toast.error("24hr window closed. Send a template first.");
      return;
    }

    setSending(true);
    try {
      await sendTextMessage(contact.phone_number, text.trim(), contact.id);
      setText("");
      onMessageSent();
    } catch (e: any) {
      toast.error("Failed to send: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File, type: "image" | "video" | "document") => {
    setSending(true);
    setShowAttach(false);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(`outgoing/${fileName}`, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(`outgoing/${fileName}`);

      await sendMediaMessage(
        contact.phone_number,
        type,
        urlData.publicUrl,
        "",
        contact.id,
        file.type,
        file.name
      );
      onMessageSent();
      toast.success("Media sent!");
    } catch (e: any) {
      toast.error("Failed to send media: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSend = async (template: Template) => {
    setSending(true);
    try {
      await sendTemplateMessage(
        contact.phone_number,
        template.name,
        template.language,
        template.components,
        contact.id
      );
      setShowTemplateDialog(false);
      onMessageSent();
      toast.success("Template sent!");
    } catch (e: any) {
      toast.error("Failed to send template: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-primary shrink-0">
        <button onClick={onBack} className="md:hidden text-primary-foreground">
          <ArrowLeft size={22} />
        </button>
        <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground font-bold shrink-0">
          {(contact.name || contact.phone_number).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-primary-foreground truncate">
            {contact.name || contact.phone_number}
          </p>
          <p className="text-xs text-primary-foreground/70 truncate">{contact.phone_number}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {windowOpen ? (
            <span className="text-xs bg-primary-foreground/20 text-primary-foreground px-2 py-1 rounded-full flex items-center gap-1">
              <Clock size={12} /> 24h Open
            </span>
          ) : (
            <button
              onClick={() => setShowTemplateDialog(true)}
              className="text-xs bg-primary-foreground/20 text-primary-foreground px-2 py-1 rounded-full hover:bg-primary-foreground/30"
            >
              Send Template
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto wa-chat-bg custom-scrollbar px-3 py-2 min-h-0">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - ALWAYS visible */}
      <div className="shrink-0 bg-card border-t border-border px-2 py-2">
        {!windowOpen && (
          <div className="text-center text-xs text-muted-foreground mb-2 bg-accent/50 py-1.5 rounded">
            24hr window closed.{" "}
            <button
              onClick={() => setShowTemplateDialog(true)}
              className="text-primary font-medium underline"
            >
              Send template
            </button>{" "}
            to reopen.
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <div className="relative">
            <button
              onClick={() => setShowAttach(!showAttach)}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
              disabled={!windowOpen}
            >
              <Paperclip size={20} />
            </button>
            {showAttach && (
              <div className="absolute bottom-12 left-0 bg-card rounded-lg shadow-lg border border-border p-2 flex flex-col gap-1 z-10 min-w-[140px]">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm"
                >
                  <Image size={16} className="text-primary" /> Photo
                </button>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm"
                >
                  <Video size={16} className="text-primary" /> Video
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm"
                >
                  <FileText size={16} className="text-primary" /> Document
                </button>
                <button
                  onClick={() => {
                    setShowAttach(false);
                    setShowTemplateDialog(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm"
                >
                  <FileText size={16} className="text-primary" /> Template
                </button>
              </div>
            )}
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f, "video");
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f, "document");
              e.target.value = "";
            }}
          />

          <div className="flex-1 min-w-0">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={windowOpen ? "Type a message..." : "Window closed - send template"}
              disabled={!windowOpen}
              rows={1}
              className="w-full resize-none rounded-2xl bg-secondary px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[120px]"
              style={{ minHeight: "40px" }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || !windowOpen}
            className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {showTemplateDialog && (
        <TemplateDialog
          onClose={() => setShowTemplateDialog(false)}
          onSend={handleTemplateSend}
        />
      )}
    </div>
  );
}
