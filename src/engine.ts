import { Chess } from 'chess.js';

const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE_SCORE = 100000;

// Small positional nudge toward the center for knights/pawns; keeps the
// engine from playing purely material-blind moves without much extra cost.
const CENTER_BONUS: Record<string, number> = {
  d4: 10, e4: 10, d5: 10, e5: 10,
  c3: 4, d3: 4, e3: 4, f3: 4,
  c4: 4, f4: 4, c5: 4, f5: 4,
  c6: 4, d6: 4, e6: 4, f6: 4,
};

// Distance of each square from the board edge (0 = on the edge, 3 = center-most).
// Used to push the losing king toward the edge in the endgame, which is exactly
// the technique material-only evaluation otherwise can't express — cornering a
// king takes more lookahead than shallow search affords, so we nudge toward
// it directly in the static evaluation instead of relying on deeper search.
function edgeDistance(square: string): number {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = square.charCodeAt(1) - '1'.charCodeAt(0);
  return Math.min(Math.min(file, 7 - file), Math.min(rank, 7 - rank));
}

function kingSquareDistance(a: string, b: string): number {
  const af = a.charCodeAt(0) - 'a'.charCodeAt(0);
  const ar = a.charCodeAt(1) - '1'.charCodeAt(0);
  const bf = b.charCodeAt(0) - 'a'.charCodeAt(0);
  const br = b.charCodeAt(1) - '1'.charCodeAt(0);
  return Math.max(Math.abs(af - bf), Math.abs(ar - br)); // Chebyshev distance
}

function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -MATE_SCORE : MATE_SCORE;
  }
  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;
  let nonKingMaterial = 0;
  let whiteKingSquare = '';
  let blackKingSquare = '';

  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell) continue;
      if (cell.type === 'k') {
        if (cell.color === 'w') whiteKingSquare = cell.square;
        else blackKingSquare = cell.square;
        continue;
      }
      let val = PIECE_VALUES[cell.type];
      if (cell.type === 'n' || cell.type === 'p') {
        val += CENTER_BONUS[cell.square] ?? 0;
      }
      nonKingMaterial += val;
      score += cell.color === 'w' ? val : -val;
    }
  }

  // Endgame technique: once material is low and one side is clearly ahead,
  // drive the losing king toward the edge and bring the winning king closer.
  if (nonKingMaterial < 2400 && whiteKingSquare && blackKingSquare) {
    if (Math.abs(score) > 150) {
      const winnerIsWhite = score > 0;
      const losingKing = winnerIsWhite ? blackKingSquare : whiteKingSquare;
      const winningKing = winnerIsWhite ? whiteKingSquare : blackKingSquare;
      const pushToEdge = (3 - edgeDistance(losingKing)) * 12;
      const closeIn = (8 - kingSquareDistance(winningKing, losingKing)) * 6;
      const bonus = pushToEdge + closeIn;
      score += winnerIsWhite ? bonus : -bonus;
    }
  }

  return score;
}

// Captures first (biggest victim / smallest attacker first) so alpha-beta
// prunes far more branches without changing the result. This is the single
// biggest cheap win available here — it roughly halves search time in busy
// positions, which matters a lot given chess.js's move generation is itself
// not fast.
function orderMoves(moves: any[]): any[] {
  // Shuffle first so ties (equal capture value, or all non-captures) don't
  // always resolve the same way — Array.sort is stable, so this shuffle
  // survives within each priority group after the sort below.
  const shuffled = [...moves].sort(() => Math.random() - 0.5);
  return shuffled.sort((a, b) => {
    const av = a.captured ? PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece] / 10 : -1;
    const bv = b.captured ? PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece] / 10 : -1;
    return bv - av;
  });
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (game.isCheckmate()) {
    const mate = game.turn() === 'w' ? -MATE_SCORE : MATE_SCORE;
    // Prefer faster mates (and delay being mated): score shrinks with distance,
    // so the engine picks the shortest forced mate it can find instead of
    // shuffling once a win is already guaranteed.
    return mate > 0 ? mate - (10 - depth) : mate + (10 - depth);
  }
  if (game.isDraw() || game.isStalemate()) return 0;
  if (depth === 0) return evaluateBoard(game);

  const moves = orderMoves(game.moves({ verbose: true }) as any[]);
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move({ from: m.from, to: m.to, promotion: m.promotion });
      best = Math.max(best, minimax(game, depth - 1, alpha, beta, false));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      game.move({ from: m.from, to: m.to, promotion: m.promotion });
      best = Math.min(best, minimax(game, depth - 1, alpha, beta, true));
      game.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export interface EngineMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

// Finds the best move for the side to move in `game`, searching `depth` plies.
// Operates on the passed instance directly (with move/undo), so callers
// should pass a disposable clone, not the app's live game object.
export function findBestMove(game: Chess, depth: number): EngineMove | null {
  const moves = orderMoves(game.moves({ verbose: true }) as any[]);
  if (moves.length === 0) return null;

  const maximizing = game.turn() === 'w';
  let bestMove: any = null;
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const m of moves) {
    game.move({ from: m.from, to: m.to, promotion: m.promotion });
    const score = minimax(game, depth - 1, -Infinity, Infinity, !maximizing);
    game.undo();
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return bestMove ? { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion } : null;
}

export const DIFFICULTY_DEPTH: Record<'easy' | 'medium' | 'hard', number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export interface EngineStrength {
  depth: number;
  // Probability (0-1) of playing a random legal move instead of the
  // engine's best move. Three search-depth tiers alone can't distinguish
  // eight opponents, so weaker characters additionally blunder more often —
  // this is what actually makes the earliest opponents feel beatable.
  blunderChance: number;
}

export function findMoveForStrength(game: Chess, strength: EngineStrength): EngineMove | null {
  const moves = game.moves({ verbose: true }) as any[];
  if (moves.length === 0) return null;

  if (Math.random() < strength.blunderChance) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  return findBestMove(game, strength.depth);
}
