// Sound Link codec: 6-bit symbols, each sent as a 3-tone chord (one tone per band).
// Pure logic, no audio APIs, so it can be unit-tested in node.

// 3 bands x 4 tones, all in the 1.1-3.8 kHz range where phone speakers and mics
// respond best. No tone is within 50 Hz of a 2nd/3rd harmonic of another.
export const BANDS: number[][] = [
  [1150, 1430, 1670, 1860],
  [2220, 2400, 2620, 2800],
  [3100, 3280, 3580, 3770],
];

export const TONE_MS = 120;
export const GAP_MS = 60;

export const PRE1 = 21; // 010101
export const PRE2 = 42; // 101010

export type FrameType = 'test' | 'move' | 'ack' | 'hello' | 'resign' | 'drawOffer' | 'drawAccept' | 'drawDecline';
export const TYPES: FrameType[] = ['test', 'move', 'ack', 'hello', 'resign', 'drawOffer', 'drawAccept', 'drawDecline'];
// number of payload symbols per type
export const PAYLOAD_LEN: Record<FrameType, number> = {
  test: 2, move: 5, ack: 0, hello: 2, resign: 0, drawOffer: 0, drawAccept: 0, drawDecline: 0,
};

export interface Frame {
  type: FrameType;
  seq: number; // 0..7
  payload: number[]; // 6-bit symbols
}

export function symbolToTones(sym: number): [number, number, number] {
  return [BANDS[0][sym & 3], BANDS[1][(sym >> 2) & 3], BANDS[2][(sym >> 4) & 3]];
}

// CRC-6, polynomial x^6 + x + 1, over the bits of the symbols (MSB first).
export function crc6(symbols: number[]): number {
  let crc = 0;
  for (const s of symbols) {
    for (let b = 5; b >= 0; b--) {
      const bit = (s >> b) & 1;
      const top = (crc >> 5) & 1;
      crc = (crc << 1) & 0x3f;
      if (top ^ bit) crc ^= 0x03;
    }
  }
  return crc;
}

export function encodeFrame(f: Frame): number[] {
  const hdr = (TYPES.indexOf(f.type) << 3) | (f.seq & 7);
  const body = [hdr, ...f.payload];
  return [PRE1, PRE2, ...body, crc6(body)];
}

export function frameLength(type: FrameType): number {
  return 2 + 1 + PAYLOAD_LEN[type] + 1;
}

// Try to parse a frame ending at the end of `buf`. Returns it or null.
export function tryParse(buf: number[]): Frame | null {
  for (const type of TYPES) {
    const len = frameLength(type);
    if (buf.length < len) continue;
    const s = buf.length - len;
    if (buf[s] !== PRE1 || buf[s + 1] !== PRE2) continue;
    const hdr = buf[s + 2];
    if (hdr >> 3 !== TYPES.indexOf(type)) continue;
    const body = buf.slice(s + 2, buf.length - 1);
    if (crc6(body) !== buf[buf.length - 1]) continue;
    return { type, seq: hdr & 7, payload: body.slice(1) };
  }
  return null;
}

// Helpers for payloads
export function packTest(value12: number): number[] {
  return [(value12 >> 6) & 63, value12 & 63];
}
export function unpackTest(p: number[]): number {
  return (p[0] << 6) | p[1];
}

const PROMO = [undefined, 'q', 'r', 'b', 'n'] as const;
// Move payload: from (6 bits), to (6 bits), promotion (0-4), mover's remaining clock seconds (12 bits).
export function packMove(from: number, to: number, promotion?: string, secs = 0): number[] {
  const pi = Math.max(0, PROMO.indexOf(promotion as never));
  const t = Math.max(0, Math.min(4095, Math.round(secs)));
  return [from & 63, to & 63, pi, (t >> 6) & 63, t & 63];
}
export function unpackMove(p: number[]): { from: number; to: number; promotion?: string; secs: number } {
  return { from: p[0], to: p[1], promotion: PROMO[p[2]] ?? undefined, secs: (p[3] << 6) | p[4] };
}
export const squareToIndex = (sq: string) => (sq.charCodeAt(0) - 97) + 8 * (sq.charCodeAt(1) - 49);
export const indexToSquare = (i: number) => String.fromCharCode(97 + (i % 8)) + String.fromCharCode(49 + Math.floor(i / 8));
