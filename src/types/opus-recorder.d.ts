declare module "opus-recorder" {
  export default class Recorder {
    constructor(config?: Record<string, unknown>);
    initStream(stream: MediaStream): Promise<void>;
    start(): void;
    stop(): Promise<void>;
    close(): void;
    ondataavailable?: (data: Uint8Array) => void;
    onstop?: () => void;
  }
}

declare module "opus-recorder/dist/encoderWorker.min.js?url" {
  const url: string;
  export default url;
}