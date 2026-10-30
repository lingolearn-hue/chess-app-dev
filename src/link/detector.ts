import { BANDS } from './codec';

// Turns a stream of magnitude spectra (dB, e.g. AnalyserNode.getFloatFrequencyData)
// into 6-bit symbols. Needs no clock sync: a symbol is a run of >= MIN_RUN reads
// with the same stable chord; silence or a different chord ends the run.

const MIN_MARGIN_DB = 8; // best tone vs second-best tone in the same band
const MIN_ABOVE_FLOOR_DB = 12; // best tone vs band median
const MIN_RUN = 3;

export interface BandReading {
  idx: number;
  ok: boolean;
  peakDb: number;
}

export class SymbolDetector {
  private run = -1;
  private count = 0;
  private sampleRate: number;
  private fftSize: number;
  private onSymbol: (s: number) => void;
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

  /** Feed one spectrum. Returns the current mean peak level (dB) for a level meter. */
  push(spec: Float32Array): number {
    const r = [this.readBand(spec, 0), this.readBand(spec, 1), this.readBand(spec, 2)];
    const active = r.every((x) => x.ok);
    const sym = active ? r[0].idx | (r[1].idx << 2) | (r[2].idx << 4) : -1;
    if (sym === this.run) {
      if (sym >= 0) this.count++;
    } else {
      if (this.run >= 0 && this.count >= MIN_RUN) this.onSymbol(this.run);
      this.run = sym;
      this.count = sym >= 0 ? 1 : 0;
    }
    return (r[0].peakDb + r[1].peakDb + r[2].peakDb) / 3;
  }

  reset() {
    this.run = -1;
    this.count = 0;
  }
}
