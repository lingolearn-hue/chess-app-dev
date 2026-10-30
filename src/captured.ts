import type { Chess } from 'chess.js';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export interface CapturedInfo {
  byWhite: string[]; // black pieces White has captured, in order
  byBlack: string[]; // white pieces Black has captured, in order
  whiteAdvantage: number;
}

/** Derives captured pieces from a Chess instance's own move history. */
export function capturedFromHistory(game: Chess): CapturedInfo {
  const byWhite: string[] = [];
  const byBlack: string[] = [];
  for (const m of game.history({ verbose: true }) as Array<{ color: 'w' | 'b'; captured?: string }>) {
    if (!m.captured) continue;
    (m.color === 'w' ? byWhite : byBlack).push(m.captured);
  }
  const sum = (a: string[]) => a.reduce((t, x) => t + (VALUE[x] ?? 0), 0);
  return { byWhite, byBlack, whiteAdvantage: sum(byWhite) - sum(byBlack) };
}
