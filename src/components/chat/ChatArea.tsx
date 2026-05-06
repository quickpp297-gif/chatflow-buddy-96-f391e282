import { useState, useRef, useEffect } from "react";
import {
  Contact,
  Message,
  isWindowOpen,
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  uploadAccountMedia,
  Template,
} from "@/lib/whatsapp";
import {
  ArrowLeft, Send, Paperclip, Image as ImgIcon, FileText, Video as VideoIcon, Clock, Mic, Smile,
} from "lucide-react";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
import { TemplateDialog } from "./TemplateDialog";
import { VoiceRecorder } from "./VoiceRecorder";
import { useAccount } from "@/hooks/useAccount";

interface ChatAreaProps {
  contact: Contact;
  messages: Message[];
  onBack: () => void;
  onMessageSent: () => void;
}

export function ChatArea({ contact, messages, onBack, onMessageSent }: ChatAreaProps) {
  const { current: account } = useAccount();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const windowOpen = isWindowOpen(contact);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!account) return null;

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    if (!windowOpen) {
      toast.error("24hr window closed. Send a template first.");
      return;
    }
    setSending(true);
    try {
      await sendTextMessage(account.id, contact.phone_number, text.trim(), contact.id);
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
      const url = await uploadAccountMedia(account.id, file, file.name, file.type);
      await sendMediaMessage(
        account.id, contact.phone_number, type, url,
        "", contact.id, file.type, file.name
      );
      onMessageSent();
      toast.success("Sent!");
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleVoiceSend = async (blob: Blob, mime: string) => {
    setSending(true);
    try {
      // WhatsApp Cloud API expects audio/ogg with opus codec. Force .ogg extension
      // and ogg mime so Meta's link-based send accepts it (most browsers record opus,
      // which is wire-compatible with ogg containers for short clips).
      const sendMime = "audio/ogg";
      const url = await uploadAccountMedia(
        account.id, blob, `voice_${Date.now()}.ogg`, sendMime
      );
      await sendMediaMessage(
        account.id, contact.phone_number, "audio", url,
        "", contact.id, sendMime, undefined
      );
      setRecording(false);
      onMessageSent();
      toast.success("Voice sent!");
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSend = async (template: Template) => {
    setSending(true);
    try {
      await sendTemplateMessage(
        account.id, contact.phone_number, template.name, template.language,
        template.components, contact.id
      );
      setShowTemplateDialog(false);
      onMessageSent();
      toast.success("Template sent!");
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header (WhatsApp dark green) */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[hsl(var(--wa-header))] shrink-0">
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
            <span className="text-[11px] bg-primary-foreground/20 text-primary-foreground px-2 py-1 rounded-full flex items-center gap-1">
              <Clock size={11} /> 24h
            </span>
          ) : (
            <button
              onClick={() => setShowTemplateDialog(true)}
              className="text-xs bg-primary-foreground/20 text-primary-foreground px-2 py-1 rounded-full"
            >
              Template
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

      {/* Input area */}
      <div className="shrink-0 bg-[hsl(var(--wa-input-bar))] px-2 py-2 border-t border-border">
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

        {recording ? (
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setRecording(false)}
          />
        ) : (
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
                <div className="absolute bottom-12 left-0 bg-card rounded-lg shadow-lg border border-border p-2 flex flex-col gap-1 z-10 min-w-[150px]">
                  <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm">
                    <ImgIcon size={16} className="text-primary" /> Photo
                  </button>
                  <button onClick={() => videoInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm">
                    <VideoIcon size={16} className="text-primary" /> Video
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm">
                    <FileText size={16} className="text-primary" /> Document
                  </button>
                  <button onClick={() => { setShowAttach(false); setShowTemplateDialog(true); }} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary text-sm">
                    <Smile size={16} className="text-primary" /> Template
                  </button>
                </div>
              )}
            </div>

            <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "image"); e.target.value = ""; }} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "video"); e.target.value = ""; }} />
            <input ref={fileInputRef} type="file" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "document"); e.target.value = ""; }} />

            <div className="flex-1 min-w-0">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={windowOpen ? "Type a message" : "Window closed - send template"}
                disabled={!windowOpen}
                rows={1}
                className="w-full resize-none rounded-2xl bg-card px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[120px] border border-border"
                style={{ minHeight: "40px" }}
              />
            </div>

            {text.trim() ? (
              <button
                onClick={handleSend}
                disabled={sending || !windowOpen}
                className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                onClick={() => setRecording(true)}
                disabled={!windowOpen}
                className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
                title="Record voice message"
              >
                <Mic size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {showTemplateDialog && (
        <TemplateDialog
          accountId={account.id}
          onClose={() => setShowTemplateDialog(false)}
          onSend={handleTemplateSend}
        />
      )}
    </div>
  );
}