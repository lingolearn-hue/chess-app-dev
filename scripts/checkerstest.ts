import { CELLS, initialMarbles, destinationsFor, hasWon, applyMove, inTarget, cellAt, project } from '../src/checkers/logic';
let fails = 0; const chk = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
chk(CELLS.length === 121, 'board has 121 cells');
const ms = initialMarbles();
chk(ms.length === 20 && ms.filter(m => m.owner === 1).length === 10, '10 marbles each');
// opening: count moves for player 1
let moves = 0; for (const m of ms.filter(q => q.owner === 1)) moves += destinationsFor(ms, m.id).length;
console.log('opening moves for player 1:', moves);
// hop chain: marble at (0,0) with stones at (1,-1)->land (2,-2) then (3,-2)->land(4,-2)... build custom
const custom = [
  { id: 0, owner: 1 as const, idx: cellAt(0, 0) },
  { id: 1, owner: 2 as const, idx: cellAt(1, 0) }, // hop over -> (2,0)
  { id: 2, owner: 2 as const, idx: cellAt(2, -1) }, // from (2,0) hop dir (0,-1) -> over (2,-1) -> (2,-2)
];
const d = destinationsFor(custom, 0).map(i => `${CELLS[i].x},${CELLS[i].y}`).sort();
chk(d.includes('2,0') && d.includes('2,-2'), 'hop chain reaches 2,0 and 2,-2: ' + d.join(' '));
chk(!d.includes('1,0'), 'cannot land on occupied');
// win: fill target with own marbles
const target = CELLS.filter(c => inTarget(1, c));
const w = target.map((c, i) => ({ id: i, owner: 1 as const, idx: c.idx }));
chk(hasWon(w, 1), 'player 1 wins with full target');
const w2 = w.map((m, i) => i === 0 ? { ...m, owner: 2 as const } : m);
chk(hasWon(w2, 1), 'win with one blocker present (own marble also there)');
const w3 = w.map(m => ({ ...m, owner: 2 as const }));
chk(!hasWon(w3, 1), 'no win if target is all opponent');
chk(!hasWon(ms, 1), 'no win at start');
// projection: own corner at bottom for both viewers
const maxPy1 = Math.max(...ms.filter(m => m.owner === 1).map(m => project(CELLS[m.idx], 1).py));
const maxPy2 = Math.max(...ms.filter(m => m.owner === 2).map(m => project(CELLS[m.idx], 2).py));
const minPy1 = Math.min(...ms.filter(m => m.owner === 2).map(m => project(CELLS[m.idx], 1).py));
chk(maxPy1 > 6 && maxPy2 > 6 && minPy1 < -6, `own corner at bottom (y ${maxPy1.toFixed(1)}, ${maxPy2.toFixed(1)}), opponent at top (${minPy1.toFixed(1)})`);
const ext = CELLS.map(c => project(c, 1)); console.log('extent x', Math.min(...ext.map(e => e.px)).toFixed(2), Math.max(...ext.map(e => e.px)).toFixed(2), 'y', Math.min(...ext.map(e => e.py)), Math.max(...ext.map(e => e.py)));
// adjacency distance sanity
const a = project(CELLS[cellAt(0, 0)], 1), b = project(CELLS[cellAt(1, -1)], 1); chk(Math.abs(Math.hypot(a.px - b.px, a.py - b.py) - 1) < 1e-9, 'neighbor spacing 1');
void applyMove;
console.log(fails ? 'FAILS ' + fails : 'all ok');
