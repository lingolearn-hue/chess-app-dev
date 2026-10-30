import { encodeFrame, tryParse, symbolToTones, TONE_MS, GAP_MS, BANDS, packMove, unpackMove, squareToIndex, indexToSquare, Frame, TYPES, PAYLOAD_LEN } from '../src/link/codec';
import { SymbolDetector } from '../src/link/detector';

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const a = i + k, b = i + k + len / 2; const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
      re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
function gauss() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random()); }

function synth(symbols: number[], sr: number, lead: number, tail: number, noiseAmp: number, gain: number, distort: boolean) {
  const per = (TONE_MS + GAP_MS) / 1000;
  const total = Math.ceil((lead + symbols.length * per + tail) * sr);
  const pcm = new Float64Array(total);
  symbols.forEach((s, i) => {
    const t0 = lead + i * per, n0 = Math.round(t0 * sr), n = Math.round(TONE_MS / 1000 * sr);
    const tones = symbolToTones(s);
    for (let k = 0; k < n; k++) {
      const env = Math.min(1, k / (0.005 * sr), (n - k) / (0.005 * sr));
      let v = 0; for (const f of tones) { v += Math.sin(2 * Math.PI * f * (n0 + k) / sr) / 3; if (distort) v += 0.15 * Math.sin(2 * Math.PI * 2 * f * (n0 + k) / sr) / 3; }
      pcm[n0 + k] += v * env * gain;
    }
  });
  for (let i = 0; i < total; i++) { pcm[i] += gauss() * noiseAmp; if (distort) pcm[i] = Math.max(-0.8, Math.min(0.8, pcm[i] * 1.5)); }
  return pcm;
}

function decode(pcm: Float64Array, sr: number): Frame[] {
  const N = 2048, hop = Math.round(0.015 * sr); const out: Frame[] = []; const buf: number[] = [];
  const det = new SymbolDetector(sr, N, (s) => { buf.push(s); const f = tryParse(buf); if (f) { out.push(f); buf.length = 0; } });
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  const spec = new Float32Array(N / 2);
  for (let p = 0; p + N <= pcm.length; p += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = pcm[p + i] * win[i];
    fft(re, im);
    for (let b = 0; b < N / 2; b++) spec[b] = 20 * Math.log10(Math.hypot(re[b], im[b]) / N + 1e-12);
    det.push(spec);
  }
  return out;
}

// 1. static checks
let fails = 0; const chk = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } };
for (let s = 0; s < 64; s++) { const t = symbolToTones(s); chk(BANDS[0].includes(t[0]) && BANDS[1].includes(t[1]) && BANDS[2].includes(t[2]), 'tones ' + s); }
chk(indexToSquare(squareToIndex('e4')) === 'e4' && squareToIndex('a1') === 0 && squareToIndex('h8') === 63, 'sq idx');
const mv = unpackMove(packMove(squareToIndex('e7'), squareToIndex('e8'), 'q')); chk(mv.promotion === 'q' && indexToSquare(mv.to) === 'e8', 'move pack');
// all-type roundtrip clean
for (const type of TYPES) { const f: Frame = { type, seq: 5, payload: Array.from({ length: PAYLOAD_LEN[type] }, () => Math.floor(Math.random() * 64)) }; const g = tryParse(encodeFrame(f)); chk(!!g && g.type === type && g.seq === 5 && g.payload.join() === f.payload.join(), 'rt ' + type); }
// CRC single-symbol corruption detection
let undetected = 0; for (let i = 0; i < 2000; i++) { const f: Frame = { type: 'move', seq: i & 7, payload: [Math.floor(Math.random()*64), Math.floor(Math.random()*64), Math.floor(Math.random()*5)] }; const e = encodeFrame(f); const k = 2 + Math.floor(Math.random() * (e.length - 2)); e[k] = (e[k] + 1 + Math.floor(Math.random() * 63)) & 63; const g = tryParse(e); if (g && (g.payload.join() !== f.payload.join())) undetected++; }
console.log('undetected corruptions (of 2000):', undetected);

// 2. acoustic-like trials
function trial(name: string, sr: number, noise: number, gain: number, distort: boolean, n = 60) {
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const f: Frame = { type: 'move', seq: i & 7, payload: [Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), Math.floor(Math.random() * 5)] };
    const pcm = synth(encodeFrame(f), sr, 0.2 + Math.random() * 0.1, 0.3, noise, gain, distort);
    const got = decode(pcm, sr);
    if (got.length === 1 && got[0].payload.join() === f.payload.join()) ok++;
  }
  console.log(`${name}: ${ok}/${n}`); return ok / n;
}
const r: number[] = [];
r.push(trial('48k clean', 48000, 0.001, 0.5, false));
r.push(trial('44.1k clean', 44100, 0.001, 0.5, false));
r.push(trial('48k noise 0.05 gain .3', 48000, 0.05, 0.3, false));
r.push(trial('48k noise 0.1 gain .3', 48000, 0.1, 0.3, false));
r.push(trial('44.1k distorted+clipped noise .05', 44100, 0.05, 0.4, true));
r.push(trial('48k heavy noise 0.2 gain .3', 48000, 0.2, 0.3, false, 40));
console.log(fails ? 'STATIC FAILS ' + fails : 'static ok');
