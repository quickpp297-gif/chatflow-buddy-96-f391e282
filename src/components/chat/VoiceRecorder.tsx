import { forwardRef, useState, useRef, useEffect, useImperativeHandle } from "react";
import { Mic, Square, Send, Trash2, Play, Pause, LoaderCircle } from "lucide-react";
import Recorder from "opus-recorder";
import encoderPath from "opus-recorder/dist/encoderWorker.min.js?url";

interface Props {
  onSend: (blob: Blob, mime: string) => Promise<void> | void;
  onCancel: () => void;
}

export interface VoiceRecorderHandle {
  startRecording: () => Promise<void>;
}

export const VoiceRecorder = forwardRef<VoiceRecorderHandle, Props>(function VoiceRecorder({ onSend, onCancel }, ref) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<any | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    startRecording: start,
  }));

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      recorderRef.current?.close?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioRef.current) audioRef.current.pause();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const start = async () => {
    if (initializing || recording) return;
    setError(null);
    setInitializing(true);

    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (permission.state === "denied") {
          setError("Microphone blocked hai. Browser settings me allow karo.");
          setInitializing(false);
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const sourceNode = audioContext.createMediaStreamSource(stream);

      const rec = new Recorder({
        encoderPath,
        streamPages: false,
        numberOfChannels: 1,
        encoderSampleRate: 16000,
        encoderBitRate: 24000,
        sourceNode,
      });

      recorderRef.current = rec;
      rec.ondataavailable = (typedArray: Uint8Array) => {
        const arrayBuffer = new ArrayBuffer(typedArray.byteLength);
        new Uint8Array(arrayBuffer).set(typedArray);
        const recordedBlob = new Blob([arrayBuffer], { type: "audio/ogg" });
        setBlob(recordedBlob);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(recordedBlob);
        });
      };

      rec.onstop = () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        audioContext.close().catch(() => {});
      };

      await rec.start();
      setSeconds(0);
      setBlob(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setRecording(true);
      tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      console.error(err);
      if (err?.name === "NotAllowedError") setError("Mic permission deny ho gayi. Allow karke dubara tap karo.");
      else if (err?.name === "NotFoundError") setError("Microphone nahi mila.");
      else if (err?.name === "NotReadableError") setError("Microphone abhi kisi aur app me use ho raha hai.");
      else setError("Voice record start nahi ho paya.");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recorderRef.current?.close?.();
      recorderRef.current = null;
      streamRef.current = null;
    } finally {
      setInitializing(false);
    }
  };

  const stop = async () => {
    setRecording(false);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    await recorderRef.current?.stop?.();
  };

  const cancel = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    recorderRef.current?.close?.();
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
    setSending(true);
    try {
      await onSend(blob, blob.type || "audio/ogg");
    } finally {
      setSending(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 w-full bg-secondary rounded-full px-3 py-2 min-h-14">
      <button onClick={cancel} className="text-destructive p-1.5 rounded-full hover:bg-destructive/10">
        <Trash2 size={18} />
      </button>

      {recording ? (
        <>
          <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-mono flex-1">{fmt(seconds)}</span>
          <span className="text-xs text-muted-foreground">Recording...</span>
          <button onClick={stop} className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50">
            <Square size={16} />
          </button>
        </>
      ) : blob ? (
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
            disabled={sending || !blob}
            className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Voice message</p>
            <p className="text-xs text-muted-foreground truncate">
              {error || (initializing ? "Mic starting..." : "Tap to start recording")}
            </p>
          </div>
          <button
            onClick={start}
            disabled={initializing}
            className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            {initializing ? <LoaderCircle size={16} className="animate-spin" /> : <Mic size={16} />}
          </button>
        </>
      )}
    </div>
  );
});