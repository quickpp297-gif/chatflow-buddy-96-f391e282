import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Trash2, Play, Pause } from "lucide-react";
import Recorder from "opus-recorder";
import encoderPath from "opus-recorder/dist/encoderWorker.min.js?url";

interface Props {
  onSend: (blob: Blob, mime: string) => Promise<void> | void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: Props) {
  const [recording, setRecording] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sending, setSending] = useState(false);
  const recorderRef = useRef<any | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const rec = new Recorder({
          encoderPath,
          streamPages: false,
          numberOfChannels: 1,
          encoderSampleRate: 16000,
          encoderBitRate: 24000,
          sourceNode: undefined,
        });
        recorderRef.current = rec;
        rec.ondataavailable = (typedArray: Uint8Array) => {
          const arrayBuffer = typedArray.buffer.slice(
            typedArray.byteOffset,
            typedArray.byteOffset + typedArray.byteLength,
          );
          const recordedBlob = new Blob([arrayBuffer], { type: "audio/ogg; codecs=opus" });
          setBlob(recordedBlob);
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return URL.createObjectURL(recordedBlob);
          });
          setInitializing(false);
        };
        rec.onstop = () => {
          stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        };
        await rec.initStream(stream);
        rec.start();
        setInitializing(false);
        tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch (err) {
        console.error(err);
        onCancel();
      }
    })();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.close?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioRef.current) audioRef.current.pause();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = async () => {
    setRecording(false);
    if (tickRef.current) clearInterval(tickRef.current);
    await recorderRef.current?.stop?.();
  };

  const cancel = () => {
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
      await onSend(blob, blob.type || "audio/ogg; codecs=opus");
    } finally {
      setSending(false);
    }
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
          <span className="text-xs text-muted-foreground">{initializing ? "Mic starting..." : "Recording..."}</span>
          <button onClick={stop} disabled={initializing} className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50">
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
            disabled={sending || !blob}
            className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </>
      )}
    </div>
  );
}

export { Mic };