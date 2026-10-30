import { BANDS, TONE_MS, GAP_MS } from './codec';

// Turns a stream of magnitude spectra (dB, e.g. AnalyserNode.getFloatFrequencyData)
// into 6-bit symbols. Needs no clock sync. Robustness measures:
//  - tolerates a single glitchy read inside a tone,
//  - a chord that persists across the gap (room reverb) is counted as repeated
//    symbols based on how long it lasted, so "same chord twice" is not lost.

const MIN_MARGIN_DB = 6; // best tone vs second-best tone in the same band
const MIN_ABOVE_FLOOR_DB = 10; // best tone vs band median
const MIN_RUN = 3; // reads
const PERIOD_MS = TONE_MS + GAP_MS;
const MAX_REPEAT = 3;

export interface BandReading {
  idx: number;
  ok: boolean;
  peakDb: number;
}

export class SymbolDetector {
  private sampleRate: number;
  private fftSize: number;
  private onSymbol: (s: number) => void;

  // current run
  private cand = -1;
  private count = 0;
  private firstT = 0;
  private lastT = 0;
  private miss = 0;
  // challenger chord seen while a run is open
  private pend = -1;
  private pendCount = 0;
  private pendFirstT = 0;
  private lastReadT = 0;
  private hopMs = 15;

  constructor(sampleRate: number, fftSize: number, onSymbol: (s: number) => void) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.onSymbol = onSymbol;
  }

  private bin(f: number) {
    return Math.round((f * this.fftSize) / this.sampleRate);
  }

  readBand(spec: Float32Array, band: number): BandReading {
    const tones = BANDS[band];
    const vals = tones.map((f) => {
      const b = this.bin(f);
      return Math.max(spec[b - 1] ?? -200, spec[b] ?? -200, spec[b + 1] ?? -200);
    });
    let best = 0;
    for (let i = 1; i < 4; i++) if (vals[i] > vals[best]) best = i;
    let second = -Infinity;
    for (let i = 0; i < 4; i++) if (i !== best && vals[i] > second) second = vals[i];
    // floor = median of the bins between the first and last tone of the band
    const lo = this.bin(tones[0]) - 2, hi = this.bin(tones[3]) + 2;
    const slice: number[] = [];
    for (let b = lo; b <= hi; b++) slice.push(spec[b]);
    slice.sort((a, b) => a - b);
    const floor = slice[Math.floor(slice.length / 2)];
    const ok = vals[best] - second >= MIN_MARGIN_DB && vals[best] - floor >= MIN_ABOVE_FLOOR_DB;
    return { idx: best, ok, peakDb: vals[best] };
  }

  private flush() {
    if (this.cand >= 0 && this.count >= MIN_RUN) {
      const dur = this.lastT - this.firstT + this.hopMs;
      const copies = Math.max(1, Math.min(MAX_REPEAT, Math.round((dur + GAP_MS) / PERIOD_MS)));
      for (let i = 0; i < copies; i++) this.onSymbol(this.cand);
    }
    this.cand = -1;
    this.count = 0;
    this.miss = 0;
  }

  /** Feed one spectrum taken at time `nowMs`. Returns the mean peak level (dB) for a level meter. */
  push(spec: Float32Array, nowMs: number = performance.now()): number {
    if (this.lastReadT > 0) this.hopMs = Math.min(40, Math.max(5, nowMs - this.lastReadT));
    this.lastReadT = nowMs;

    const r = [this.readBand(spec, 0), this.readBand(spec, 1), this.readBand(spec, 2)];
    const active = r.every((x) => x.ok);
    const sym = active ? r[0].idx | (r[1].idx << 2) | (r[2].idx << 4) : -1;

    if (this.cand < 0) {
      if (sym >= 0) {
        this.cand = sym;
        this.count = 1;
        this.firstT = this.lastT = nowMs;
        this.miss = 0;
        this.pend = -1;
      }
    } else if (sym === this.cand) {
      this.count++;
      this.lastT = nowMs;
      this.miss = 0;
      this.pend = -1;
      this.pendCount = 0;
    } else if (sym < 0) {
      // silence / unclear read: one glitch is tolerated, two end the run
      this.miss++;
      this.pend = -1;
      this.pendCount = 0;
      if (this.miss >= 2) this.flush();
    } else {
      // a different chord: needs two consecutive reads to replace the current run
      if (sym === this.pend) {
        this.pendCount++;
      } else {
        this.pend = sym;
        this.pendCount = 1;
        this.pendFirstT = nowMs;
      }
      if (this.pendCount >= 2) {
        this.flush();
        this.cand = sym;
        this.count = this.pendCount;
        this.firstT = this.pendFirstT;
        this.lastT = nowMs;
        this.miss = 0;
        this.pend = -1;
        this.pendCount = 0;
      }
    }
    return (r[0].peakDb + r[1].peakDb + r[2].peakDb) / 3;
  }

  reset() {
    this.cand = -1;
    this.count = 0;
    this.miss = 0;
    this.pend = -1;
    this.pendCount = 0;
    this.lastReadT = 0;
  }
}
