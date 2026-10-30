import { encodeFrame, tryParse, symbolToTones, TONE_MS, GAP_MS } from './codec';
import type { Frame, FrameType } from './codec';
import { SymbolDetector } from './detector';

const FFT = 2048;
const ACK_WAIT_MS = 1800;
const MAX_ATTEMPTS = 5;

export interface LinkEvents {
  onFrame?: (f: Frame) => void; // new (non-duplicate) data frame
  onLevel?: (db: number) => void;
  onSymbol?: (s: number) => void;
  onTx?: (sending: boolean) => void;
}

export class SoundLink {
  ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private detector: SymbolDetector | null = null;
  private buf: number[] = [];
  private lastSymbolAt = 0;
  private sending = false;
  private unmuteAt = 0;
  private seq = 0;
  private lastRxSeq = -1;
  private pendingAck: { seq: number; resolve: () => void } | null = null;
  /** When true the device hears its own transmissions (loopback test). */
  selfHear = false;
  /** Auto-acknowledge received data frames. */
  autoAck = true;
  ev: LinkEvents = {};

  /** Must be called from a user gesture (iOS). */
  async start(): Promise<void> {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  get listening() {
    return this.stream !== null;
  }

  async listen(): Promise<void> {
    await this.start();
    if (this.stream || !this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = this.ctx.createMediaStreamSource(this.stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = FFT;
    an.smoothingTimeConstant = 0;
    src.connect(an);
    this.analyser = an;
    const spec = new Float32Array(an.frequencyBinCount);
    this.detector = new SymbolDetector(this.ctx.sampleRate, FFT, (s) => this.handleSymbol(s));
    this.timer = window.setInterval(() => {
      if (!this.analyser || !this.detector) return;
      this.analyser.getFloatFrequencyData(spec);
      const muted = !this.selfHear && (this.sending || performance.now() < this.unmuteAt);
      if (muted) {
        this.detector.reset();
        return;
      }
      const level = this.detector.push(spec);
      this.ev.onLevel?.(level);
    }, 15);
  }

  stopListening() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    this.detector = null;
    this.ev.onLevel?.(-120);
  }

  private handleSymbol(s: number) {
    const now = performance.now();
    if (now - this.lastSymbolAt > 1000) this.buf.length = 0;
    this.lastSymbolAt = now;
    this.ev.onSymbol?.(s);
    this.buf.push(s);
    if (this.buf.length > 16) this.buf.shift();
    const f = tryParse(this.buf);
    if (!f) return;
    this.buf.length = 0;
    this.handleFrame(f);
  }

  private handleFrame(f: Frame) {
    if (f.type === 'ack') {
      if (this.pendingAck && this.pendingAck.seq === f.seq) this.pendingAck.resolve();
      return;
    }
    const dup = f.seq === this.lastRxSeq;
    this.lastRxSeq = f.seq;
    if (this.autoAck) {
      window.setTimeout(() => void this.play({ type: 'ack', seq: f.seq, payload: [] }), 250);
    }
    if (!dup) this.ev.onFrame?.(f);
  }

  /** Play one frame (no retry). Resolves when playback has finished. */
  play(f: Frame): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return Promise.reject(new Error('audio not started'));
    const symbols = encodeFrame(f);
    const per = (TONE_MS + GAP_MS) / 1000;
    const t0 = ctx.currentTime + 0.05;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    symbols.forEach((s, i) => {
      const start = t0 + i * per;
      const end = start + TONE_MS / 1000;
      for (const freq of symbolToTones(s)) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.3, start + 0.005);
        g.gain.setValueAtTime(0.3, end - 0.005);
        g.gain.linearRampToValueAtTime(0, end);
        osc.connect(g).connect(master);
        osc.start(start);
        osc.stop(end + 0.01);
      }
    });
    this.sending = true;
    this.ev.onTx?.(true);
    const durMs = (t0 - ctx.currentTime) * 1000 + symbols.length * per * 1000;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        this.sending = false;
        this.unmuteAt = performance.now() + 250; // let room echo die down
        this.ev.onTx?.(false);
        resolve();
      }, durMs);
    });
  }

  /** Send a data frame, retrying until acked. Resolves with attempts used, or 0 on failure. */
  async sendReliable(type: FrameType, payload: number[]): Promise<number> {
    const seq = this.seq;
    this.seq = (this.seq + 1) & 7;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let done = false;
      const waitAck = new Promise<boolean>((resolve) => {
        this.pendingAck = {
          seq,
          resolve: () => {
            done = true;
            resolve(true);
          },
        };
      });
      await this.play({ type, seq, payload });
      const ok = await Promise.race([waitAck, new Promise<boolean>((r) => window.setTimeout(() => r(done), ACK_WAIT_MS))]);
      this.pendingAck = null;
      if (ok) return attempt;
    }
    return 0;
  }

  close() {
    this.stopListening();
    void this.ctx?.close();
    this.ctx = null;
  }
}
