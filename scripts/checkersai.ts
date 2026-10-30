import { initialMarbles, applyMove, hasWon } from '../src/checkers/logic';
import { chooseMove } from '../src/checkers/ai';
import type { CheckersLevel } from '../src/checkers/ai';
import type { Player } from '../src/checkers/logic';
function play(l1: CheckersLevel, l2: CheckersLevel, cap = 150) {
  let m = initialMarbles(); let turn: Player = 1; let t = 0; const t0 = Date.now(); let maxMs = 0;
  for (let n = 0; n < cap * 2; n++) {
    const s = Date.now(); const mv = chooseMove(m, turn, turn === 1 ? l1 : l2); maxMs = Math.max(maxMs, Date.now() - s);
    if (!mv) { turn = turn === 1 ? 2 : 1; continue; }
    m = applyMove(m, mv.marbleId, mv.to);
    if (hasWon(m, turn)) return `${l1} vs ${l2}: P${turn} won after ${Math.ceil((n + 1) / 2)} moves each (max think ${maxMs} ms, total ${Date.now() - t0} ms)`;
    turn = turn === 1 ? 2 : 1; t++;
  }
  return `${l1} vs ${l2}: no winner in ${cap} moves each (max think ${maxMs} ms)`;
}
console.log(play('hard', 'easy')); console.log(play('medium', 'easy')); console.log(play('hard', 'medium')); console.log(play('easy', 'hard'));
// tournament: hard vs medium both colours, 6 games each
function res(l1: CheckersLevel, l2: CheckersLevel) { const r = play(l1, l2); const m = r.match(/P(\d) won after (\d+)/); return m ? { w: +m[1], n: +m[2] } : { w: 0, n: 150 }; }
let hardWins = 0, games = 0, hardMoves = 0, medMoves = 0;
for (let i = 0; i < 6; i++) { let r = res('hard', 'medium'); if (r.w === 1) hardWins++; games++; hardMoves += r.n; r = res('medium', 'hard'); if (r.w === 2) hardWins++; games++; medMoves += r.n; }
console.log(`hard beat medium ${hardWins}/${games}; avg length as P1 ${hardMoves / 6}, as P2 ${medMoves / 6}`);
