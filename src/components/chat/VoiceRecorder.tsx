import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Trash2, Play, Pause } from "lucide-react";

interface Props {
  onSend: (blob: Blob, mime: string) => Promise<void> | void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: Props) {
  const [recording, setRecording] = useState(true);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mimeOptions = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];
        const mime = mimeOptions.find((m) => MediaRecorder.isTypeSupported(m)) || "";
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        mediaRef.current = rec;
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        rec.onstop = () => {
          const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          setBlob(b);
          setPreviewUrl(URL.createObjectURL(b));
          stream.getTracks().forEach((t) => t.stop());
        };
        rec.start();
        tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch (err) {
        console.error(err);
        onCancel();
      }
    })();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    setRecording(false);
    if (tickRef.current) clearInterval(tickRef.current);
    mediaRef.current?.stop();
  };

  const cancel = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
  };

  const send = async () => {
    if (!blob) return;
    await onSend(blob, blob.type || "audio/webm");
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 w-full bg-secondary rounded-full px-3 py-2">
      <button onClick={cancel} className="text-destructive p-1.5 rounded-full hover:bg-destructive/10">
        <Trash2 size={18} />
      </button>

      {recording ? (
        <>
          <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-mono flex-1">{fmt(seconds)}</span>
          <span className="text-xs text-muted-foreground">Recording...</span>
          <button onClick={stop} className="p-2 rounded-full bg-primary text-primary-foreground">
            <Square size={16} />
          </button>
        </>
      ) : (
        <>
          <button onClick={togglePlay} className="p-1.5 rounded-full text-primary hover:bg-primary/10">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          {previewUrl && (
            <audio
              ref={audioRef}
              src={previewUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          )}
          <span className="text-sm font-mono flex-1">{fmt(seconds)}</span>
          <button
            onClick={send}
            className="p-2 rounded-full bg-primary text-primary-foreground"
          >
            <Send size={16} />
          </button>
        </>
      )}
    </div>
  );
}

export { Mic };