import { Chess } from 'chess.js';

export interface AnalysisLine {
  from: string;
  to: string;
  kind: 'defend' | 'attack';
}

export interface GuardAttackInfo {
  lines: AnalysisLine[];
  tint: Map<string, 'blue' | 'red'>;
}

// Real attackers of a piece that's actually sitting on targetSquare: force
// the mover to attackerColor and see who can legally capture there.
function attackersOfOccupiedSquare(game: Chess, targetSquare: string, attackerColor: 'w' | 'b'): string[] {
  const fenParts = game.fen().split(' ');
  fenParts[1] = attackerColor;
  const scratch = new Chess(fenParts.join(' '));
  return (scratch.moves({ verbose: true }) as any[])
    .filter((m) => m.to === targetSquare && m.captured)
    .map((m) => m.from);
}

// Defenders of a square: temporarily stand in a dummy enemy piece there (so
// a capture move is legally generatable), then see which of defenderColor's
// own pieces could capture on that square. Uses a knight rather than a pawn
// as the stand-in: a pawn placed on the 1st/8th rank passes chess.js's
// put(), but reparsing that position's FEN through `new Chess(...)` (needed
// to force the mover) is then rejected as invalid.
function defendersOfSquare(game: Chess, targetSquare: string, defenderColor: 'w' | 'b'): string[] {
  const scratch = new Chess(game.fen());
  scratch.remove(targetSquare as any);
  const enemyColor = defenderColor === 'w' ? 'b' : 'w';
  scratch.put({ type: 'n', color: enemyColor }, targetSquare as any);
  const fenParts = scratch.fen().split(' ');
  fenParts[1] = defenderColor;
  const scratch2 = new Chess(fenParts.join(' '));
  return (scratch2.moves({ verbose: true }) as any[])
    .filter((m) => m.to === targetSquare && m.captured)
    .map((m) => m.from);
}

// For every piece belonging to `side`, finds which of the player's own
// pieces defend it and which enemy pieces attack it, producing connecting
// lines and a per-square safety tint (blue if defended at least as much as
// it's attacked, red if attacked more than defended).
export function computeGuardAttackInfo(game: Chess, side: 'w' | 'b'): GuardAttackInfo {
  const enemy: 'w' | 'b' = side === 'w' ? 'b' : 'w';
  const lines: AnalysisLine[] = [];
  const tint = new Map<string, 'blue' | 'red'>();

  const ownSquares: string[] = [];
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell && cell.color === side) ownSquares.push(cell.square);
    }
  }

  for (const sq of ownSquares) {
    const piece = game.get(sq as any);
    const attackers = attackersOfOccupiedSquare(game, sq, enemy);
    // A king's square can't be tested the normal way: removing it to stand
    // in a dummy piece would leave the position without a king, which
    // chess.js refuses to parse. The king isn't "defended" in the usual
    // sense anyway (it's never actually captured under normal play), so
    // only its attackers (i.e. check) are meaningful here.
    const defenders = piece?.type === 'k' ? [] : defendersOfSquare(game, sq, side);
    for (const a of attackers) lines.push({ from: a, to: sq, kind: 'attack' });
    for (const d of defenders) lines.push({ from: d, to: sq, kind: 'defend' });
    tint.set(sq, defenders.length >= attackers.length ? 'blue' : 'red');
  }

  return { lines, tint };
}
