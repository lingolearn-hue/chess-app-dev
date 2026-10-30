// Chinese Checkers (2 players, opposite corners, 10 marbles each).
// Cells use cube coordinates (x + y + z = 0); the board is the union of two
// big triangles. Indices are assigned in a fixed order so both phones agree.

export type Player = 1 | 2;

export interface Cell {
  x: number;
  y: number;
  z: number;
  idx: number;
}

export const CELLS: Cell[] = [];
const byKey = new Map<string, number>();
for (let x = -8; x <= 8; x++) {
  for (let y = -8; y <= 8; y++) {
    const z = -x - y;
    if (Math.abs(z) > 8) continue;
    const inStar = (x >= -4 && y >= -4 && z >= -4) || (x <= 4 && y <= 4 && z <= 4);
    if (!inStar) continue;
    byKey.set(`${x},${y}`, CELLS.length);
    CELLS.push({ x, y, z, idx: CELLS.length });
  }
}

export const DIRS: Array<[number, number]> = [[1, -1], [-1, 1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export function cellAt(x: number, y: number): number {
  return byKey.get(`${x},${y}`) ?? -1;
}

/** Player 1 starts on x >= 5 and heads for x <= -5; player 2 the reverse. */
export const inHome = (p: Player, c: Cell) => (p === 1 ? c.x >= 5 : c.x <= -5);
export const inTarget = (p: Player, c: Cell) => inHome(p === 1 ? 2 : 1, c);

export interface Marble {
  id: number;
  owner: Player;
  idx: number;
}

export function initialMarbles(): Marble[] {
  const out: Marble[] = [];
  for (const p of [1, 2] as Player[]) {
    for (const c of CELLS) if (inHome(p, c)) out.push({ id: out.length, owner: p, idx: c.idx });
  }
  return out;
}

/** All cells the given marble may move to (single steps and hop chains). */
export function destinationsFor(marbles: Marble[], marbleId: number): number[] {
  const m = marbles.find((q) => q.id === marbleId);
  if (!m) return [];
  const occupied = new Set<number>();
  for (const q of marbles) if (q.id !== marbleId) occupied.add(q.idx);
  const start = CELLS[m.idx];
  const result = new Set<number>();
  for (const [dx, dy] of DIRS) {
    const n = cellAt(start.x + dx, start.y + dy);
    if (n >= 0 && !occupied.has(n)) result.add(n);
  }
  const seen = new Set<number>([m.idx]);
  const queue = [m.idx];
  while (queue.length) {
    const cur = CELLS[queue.shift()!];
    for (const [dx, dy] of DIRS) {
      const mid = cellAt(cur.x + dx, cur.y + dy);
      if (mid < 0 || !occupied.has(mid)) continue;
      const land = cellAt(cur.x + 2 * dx, cur.y + 2 * dy);
      if (land < 0 || occupied.has(land) || seen.has(land)) continue;
      seen.add(land);
      result.add(land);
      queue.push(land);
    }
  }
  result.delete(m.idx);
  return [...result];
}

/** Win: the target triangle is full and at least one marble there is the player's own. */
export function hasWon(marbles: Marble[], p: Player): boolean {
  const target = CELLS.filter((c) => inTarget(p, c));
  const occ = new Map<number, Player>();
  for (const m of marbles) occ.set(m.idx, m.owner);
  return target.every((c) => occ.has(c.idx)) && target.some((c) => occ.get(c.idx) === p);
}

export function applyMove(marbles: Marble[], marbleId: number, to: number): Marble[] {
  return marbles.map((m) => (m.id === marbleId ? { ...m, idx: to } : m));
}

export function marbleAt(marbles: Marble[], idx: number): Marble | undefined {
  return marbles.find((m) => m.idx === idx);
}

// Screen position of a cell, from the given player's point of view
// (their own home corner at the bottom). Adjacent cells are 1 unit apart.
const S3 = Math.sqrt(3) / 2;
const K = 1 / Math.sqrt(3); // cube-axis vectors are sqrt(3) apart per neighbor step
export function project(c: Cell, viewer: Player): { px: number; py: number } {
  const s = viewer === 1 ? 1 : -1;
  const x = c.x * s, y = c.y * s, z = c.z * s;
  return { px: K * (-S3 * y + S3 * z), py: K * (x - 0.5 * y - 0.5 * z) };
}
