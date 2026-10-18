// Minimal Web Serial API declarations (not yet in standard TypeScript dom lib)
declare global {
  interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: {
      baudRate: number;
      dataBits?: number;
      parity?: 'none' | 'even' | 'odd';
      stopBits?: number;
    }): Promise<void>;
    close(): Promise<void>;
  }
  interface Navigator {
    readonly serial: {
      requestPort(): Promise<SerialPort>;
    };
  }
}

import {
  parseDibalFrame,
  type ScaleReading,
  SCALE_PROFILES,
  type ScaleProfileKey,
} from './dibal-driver';

export type ScaleStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface ScaleManagerOptions {
  profile: ScaleProfileKey;
  onReading: (reading: ScaleReading) => void;
  onStatus:  (status: ScaleStatus) => void;
  onError:   (message: string) => void;
}

export class ScaleManager {
  private port:   SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private running = false;
  private opts: ScaleManagerOptions;

  constructor(opts: ScaleManagerOptions) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      this.opts.onError('ERR_NO_WEB_SERIAL');
      this.opts.onStatus('error');
      return;
    }

    try {
      this.opts.onStatus('connecting');
      const profile = SCALE_PROFILES[this.opts.profile];

      this.port = await navigator.serial.requestPort();
      await this.port.open({
        baudRate: profile.baudRate,
        dataBits: profile.dataBits,
        parity:   profile.parity,
        stopBits: profile.stopBits,
      });

      this.opts.onStatus('connected');
      this.running = true;
      this.readLoop();
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message : String(err);
      if (msg.includes('No port selected')) {
        this.opts.onStatus('disconnected');
      } else {
        this.opts.onError('ERR_CONNECT:' + msg);
        this.opts.onStatus('error');
      }
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;

    const textDecoder =
      new TextDecoderStream();
    const lineBreaker  =
      new TransformStream<string, string>(
        new LineBreakTransformer()
      );

    this.port.readable
      .pipeTo(textDecoder.writable as WritableStream<Uint8Array>)
      .catch(() => this.handleDisconnect());

    this.reader = textDecoder.readable
      .pipeThrough(lineBreaker)
      .getReader();

    try {
      while (this.running) {
        const { value, done } =
          await this.reader.read();
        if (done) break;
        if (!value) continue;
        const reading = parseDibalFrame(value);
        if (reading) this.opts.onReading(reading);
      }
    } catch {
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    this.running = false;
    this.opts.onStatus('disconnected');
    this.opts.onError('ERR_DISCONNECTED');
  }

  async sendCommand(cmd: string): Promise<void> {
    if (!this.port?.writable) return;
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(cmd));
    } finally {
      writer.releaseLock();
    }
  }

  async disconnect(): Promise<void> {
    this.running = false;
    try {
      await this.reader?.cancel();
      await this.port?.close();
    } catch { /* ignore */ }
    this.port   = null;
    this.reader = null;
    this.opts.onStatus('disconnected');
  }
}

// Transform stream that splits on \r\n or \n
class LineBreakTransformer
  implements Transformer<string, string> {
  private buffer = '';

  transform(
    chunk: string,
    ctrl: TransformStreamDefaultController<string>
  ): void {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) ctrl.enqueue(line);
    }
  }

  flush(
    ctrl: TransformStreamDefaultController<string>
  ): void {
    if (this.buffer.trim()) ctrl.enqueue(this.buffer);
  }
}
