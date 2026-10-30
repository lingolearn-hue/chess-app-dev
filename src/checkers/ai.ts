import { CELLS, cellAt, destinationsFor, applyMove } from './logic';
import type { Marble, Player } from './logic';

export type CheckersLevel = 'easy' | 'medium' | 'hard';
export interface CheckersMove {
  marbleId: number;
  to: number;
}

const hexDist = (a: number, b: number) => {
  const p = CELLS[a], q = CELLS[b];
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
};

// The corner cell each player is heading for (the far tip of the opposite triangle).
const APEX: Record<Player, number> = { 1: cellAt(-8, 4), 2: cellAt(8, -4) };

// Lower is better: total distance to the goal tip, plus a penalty for stragglers
// so the whole army keeps moving together.
function cost(marbles: Marble[], p: Player): number {
  let sum = 0, max = 0;
  for (const m of marbles) {
    if (m.owner !== p) continue;
    const d = hexDist(m.idx, APEX[p]);
    sum += d;
    if (d > max) max = d;
  }
  return sum + 0.5 * max;
}

const score1 = (marbles: Marble[], p: Player) => cost(marbles, p === 1 ? 2 : 1) - cost(marbles, p);

function allMoves(marbles: Marble[], p: Player): CheckersMove[] {
  const out: CheckersMove[] = [];
  for (const m of marbles) {
    if (m.owner !== p) continue;
    for (const to of destinationsFor(marbles, m.id)) out.push({ marbleId: m.id, to });
  }
  return out;
}

export function chooseMove(marbles: Marble[], p: Player, level: CheckersLevel): CheckersMove | null {
  const moves = allMoves(marbles, p);
  if (moves.length === 0) return null;
  const scored = moves.map((mv) => {
    const after = applyMove(marbles, mv.marbleId, mv.to);
    let s = score1(after, p);
    if (level === 'hard') {
      // Look at my own best follow-up move too (assuming the opponent's reply
      // doesn't disturb me much): rewards setting up long hop chains.
      let best = s;
      for (const r of allMoves(after, p)) {
        const v = score1(applyMove(after, r.marbleId, r.to), p);
        if (v > best) best = v;
      }
      s = best + 0.25 * s;
    }
    return { mv, s: s + Math.random() * 0.01 };
  });
  scored.sort((a, b) => b.s - a.s);

  if (level === 'easy') {
    // Pick among the five best-looking moves.
    const top = scored.slice(0, 5);
    return top[Math.floor(Math.random() * top.length)].mv;
  }
  return scored[0].mv;
}
