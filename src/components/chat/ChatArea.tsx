import { useState, useRef, useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import {
  Contact,
  Message,
  deleteContactChat,
  isWindowOpen,
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  uploadAccountMedia,
  Template,
} from "@/lib/whatsapp";
import {
  ArrowLeft, Send, Paperclip, Image as ImgIcon, FileText, Video as VideoIcon, Clock, Mic, Smile, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
import { TemplateDialog } from "./TemplateDialog";
import { VoiceRecorder, VoiceRecorderHandle } from "./VoiceRecorder";
import { useAccount } from "@/hooks/useAccount";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatAreaProps {
  contact: Contact;
  messages: Message[];
  onBack: () => void;
  onMessageSent: (pendingMessage: Message) => void;
  onContactDeleted: (contactId: string) => void;
}

export function ChatArea({ contact, messages, onBack, onMessageSent, onContactDeleted }: ChatAreaProps) {
  const { current: account } = useAccount();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingLabel, setSendingLabel] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<VoiceRecorderHandle | null>(null);
  const textValueRef = useRef("");

  const windowOpen = isWindowOpen(contact);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    textValueRef.current = text;
  }, [text]);

  const canInteract = windowOpen && !sending;

  const visibleMessages = useMemo(() => messages, [messages]);

  const createPendingMessage = (partial: Partial<Message>): Message => ({
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    account_id: account.id,
    contact_id: contact.id,
    wa_message_id: null,
    direction: "outgoing",
    message_type: partial.message_type || "text",
    content: partial.content ?? null,
    media_url: partial.media_url ?? null,
    media_mime_type: partial.media_mime_type ?? null,
    media_filename: partial.media_filename ?? null,
    template_name: partial.template_name ?? null,
    template_data: partial.template_data ?? null,
    status: "pending",
    timestamp: new Date().toISOString(),
  });

  if (!account) return null;

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    if (!windowOpen) {
      toast.error("24hr window closed. Send a template first.");
      return;
    }
    const messageText = text.trim();
    setSending(true);
    setSendingLabel("Sending message...");
    setText("");
    const pendingMessage = createPendingMessage({ content: messageText });
    onMessageSent(pendingMessage);
    try {
      const response = await sendTextMessage(account.id, contact.phone_number, messageText, contact.id);
      if ((response as any)?.inserted_message) {
        onMessageSent((response as any).inserted_message);
      }
    } catch (e: any) {
      onMessageSent({ ...pendingMessage, status: "failed" });
      setText(textValueRef.current || messageText);
      toast.error("Failed to send: " + e.message);
    } finally {
      setSending(false);
      setSendingLabel(null);
    }
  };

  const handleFileUpload = async (file: File, type: "image" | "video" | "document") => {
    setSending(true);
    setSendingLabel(`Sending ${type}...`);
    setShowAttach(false);
    let localPreviewUrl: string | null = null;
    try {
      localPreviewUrl = URL.createObjectURL(file);
      const pendingMessage = createPendingMessage({
        message_type: type,
        content: "",
        media_url: localPreviewUrl,
        media_mime_type: file.type,
        media_filename: file.name,
      });
      onMessageSent(pendingMessage);
      const url = await uploadAccountMedia(account.id, file, file.name, file.type);
      const response = await sendMediaMessage(
        account.id, contact.phone_number, type, url,
        "", contact.id, file.type, file.name
      );
      if ((response as any)?.inserted_message) {
        onMessageSent((response as any).inserted_message);
      }
      toast.success("Sent!");
    } catch (e: any) {
      onMessageSent({
        ...createPendingMessage({
          message_type: type,
          content: "",
          media_url: localPreviewUrl,
          media_mime_type: file.type,
          media_filename: file.name,
        }),
        status: "failed",
      });
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
      setSendingLabel(null);
    }
  };

  const handleVoiceSend = async (blob: Blob, mime: string) => {
    setSending(true);
    setSendingLabel("Sending voice...");
    let localUrl: string | null = null;
    const pendingMessage = createPendingMessage({
      message_type: "audio",
      media_url: null,
      media_mime_type: "audio/ogg",
    });
    try {
      localUrl = URL.createObjectURL(blob);
      // WhatsApp Cloud API requires plain "audio/ogg" (no codec param) for voice notes.
      const storageMime = "audio/ogg";
      const sendMime = "audio/ogg";
      const cleanBlob = new Blob([blob], { type: storageMime });
      onMessageSent({
        ...pendingMessage,
        message_type: "audio",
        media_url: localUrl,
        media_mime_type: sendMime,
      });
      const url = await uploadAccountMedia(
        account.id, cleanBlob, `voice_${Date.now()}.ogg`, storageMime
      );
      const response = await sendMediaMessage(
        account.id, contact.phone_number, "audio", url,
        "", contact.id, sendMime, undefined
      );
      if ((response as any)?.inserted_message) {
        onMessageSent((response as any).inserted_message);
      }
      setRecording(false);
      toast.success("Voice sent!");
    } catch (e: any) {
      onMessageSent({ ...pendingMessage, media_url: localUrl, status: "failed" });
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
      setSendingLabel(null);
    }
  };

  const handleTemplateSend = async (template: Template) => {
    setSending(true);
    setSendingLabel("Sending template...");
    const pendingMessage = createPendingMessage({
      message_type: "template",
      content: `Template: ${template.name}`,
      template_name: template.name,
      template_data: template.components,
    });
    onMessageSent(pendingMessage);
    try {
      const response = await sendTemplateMessage(
        account.id, contact.phone_number, template.name, template.language,
        template.components, contact.id
      );
      if ((response as any)?.inserted_message) {
        onMessageSent((response as any).inserted_message);
      }
      setShowTemplateDialog(false);
      toast.success("Template sent!");
    } catch (e: any) {
      onMessageSent({ ...pendingMessage, status: "failed" });
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
      setSendingLabel(null);
    }
  };

  const handleDeleteChat = async () => {
    try {
      await deleteContactChat(contact.id);
      toast.success("Chat deleted");
      onContactDeleted(contact.id);
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
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
          <AlertDialog>
            <button
              type="button"
              className="text-primary-foreground/80 hover:text-primary-foreground p-1.5 rounded-full hover:bg-primary-foreground/10"
            >
              <Trash2 size={18} />
            </button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                <AlertDialogDescription>
                  {contact.name || contact.phone_number} ki puri chat aur number list se remove ho jayega.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteChat}>
                  Delete chat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
        {visibleMessages.map((msg) => (
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

        {sendingLabel && (
          <div className="text-center text-xs text-muted-foreground mb-2 bg-secondary py-1.5 rounded">
            {sendingLabel}
          </div>
        )}

        {recording ? (
          <VoiceRecorder
            ref={recorderRef}
            onSend={handleVoiceSend}
            onCancel={() => setRecording(false)}
          />
        ) : (
          <div className="flex items-end gap-1.5">
            <div className="relative">
              <button
                onClick={() => setShowAttach(!showAttach)}
                className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
                disabled={!canInteract}
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
                disabled={!canInteract}
                rows={1}
                className="w-full resize-none rounded-2xl bg-card px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[120px] border border-border"
                style={{ minHeight: "40px" }}
              />
            </div>

            {text.trim() ? (
              <button
                onClick={handleSend}
                disabled={!canInteract}
                className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                onClick={() => {
                  flushSync(() => setRecording(true));
                  recorderRef.current?.startRecording();
                }}
                disabled={!canInteract}
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