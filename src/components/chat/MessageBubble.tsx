import { Message } from "@/lib/whatsapp";
import { Check, CheckCheck, Clock, Download, LoaderCircle } from "lucide-react";
import { format } from "date-fns";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.direction === "outgoing";
  const time = format(new Date(message.timestamp), "HH:mm");

  const statusIcon = () => {
    if (!isOutgoing) return null;
    switch (message.status) {
      case "sent":
        return <Check size={14} className="text-muted-foreground" />;
      case "delivered":
        return <CheckCheck size={14} className="text-muted-foreground" />;
      case "read":
        return <CheckCheck size={14} className="text-primary" />;
      case "pending":
        return <LoaderCircle size={14} className="text-muted-foreground animate-spin" />;
      case "failed":
        return <Clock size={14} className="text-destructive" />;
      default:
        return <Check size={14} className="text-muted-foreground" />;
    }
  };

  const renderMedia = () => {
    if (!message.media_url) return null;

    const mimeType = message.media_mime_type || "";

    if (message.message_type === "image" || mimeType.startsWith("image/")) {
      return (
        <img
          src={message.media_url}
          alt="Image"
          className="rounded-lg max-w-full max-h-[300px] object-contain mb-1"
          loading="lazy"
        />
      );
    }

    if (message.message_type === "video" || mimeType.startsWith("video/")) {
      return (
        <video
          src={message.media_url}
          controls
          className="rounded-lg max-w-full max-h-[300px] mb-1"
          preload="metadata"
        />
      );
    }

    if (message.message_type === "audio" || mimeType.startsWith("audio/")) {
      return (
        <audio src={message.media_url} controls className="w-full mb-1" preload="metadata" />
      );
    }

    // Document or other
    return (
      <a
        href={message.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2 mb-1 hover:bg-secondary"
      >
        <Download size={16} className="text-primary" />
        <span className="text-sm text-primary truncate">
          {message.media_filename || "Download file"}
        </span>
      </a>
    );
  };

  const renderContent = () => {
    if (message.message_type === "template") {
      return (
        <div className="bg-accent/50 rounded p-2 mb-1">
          <span className="text-xs font-medium text-accent-foreground">📋 Template</span>
          <p className="text-sm mt-0.5">{message.content}</p>
        </div>
      );
    }

    if (message.message_type === "location" && message.content) {
      try {
        const loc = JSON.parse(message.content);
        return (
          <a
            href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            📍 {loc.name || `${loc.latitude}, ${loc.longitude}`}
          </a>
        );
      } catch {
        return <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>;
      }
    }

    return null;
  };

  return (
    <div className={`flex mb-1.5 ${isOutgoing ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-1.5 shadow-sm ${
          isOutgoing ? "msg-outgoing" : "msg-incoming"
        }`}
      >
        {renderMedia()}
        {renderContent()}
        {message.content && message.message_type !== "template" && message.message_type !== "location" && (
          <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
        )}
        <div className={`flex items-center gap-1 mt-0.5 ${isOutgoing ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {statusIcon()}
        </div>
      </div>
    </div>
  );
}
