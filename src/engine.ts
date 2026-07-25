import { Chess } from 'chess.js';

const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Small positional nudge toward the center for knights/pawns; keeps the
// engine from playing purely material-blind moves without much extra cost.
const CENTER_BONUS: Record<string, number> = {
  d4: 10, e4: 10, d5: 10, e5: 10,
  c3: 4, d3: 4, e3: 4, f3: 4,
  c4: 4, f4: 4, c5: 4, f5: 4,
  c6: 4, d6: 4, e6: 4, f6: 4,
};

function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) {
    // side to move has just been mated
    return game.turn() === 'w' ? -100000 : 100000;
  }
  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell) continue;
      let val = PIECE_VALUES[cell.type];
      if (cell.type === 'n' || cell.type === 'p') {
        val += CENTER_BONUS[cell.square] ?? 0;
      }
      score += cell.color === 'w' ? val : -val;
    }
  }
  return score;
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }
  const moves = game.moves({ verbose: true }) as any[];
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
  const moves = game.moves({ verbose: true }) as any[];
  if (moves.length === 0) return null;

  const maximizing = game.turn() === 'w';
  // Shuffle so equally-scored moves aren't always picked in the same order.
  const shuffled = [...moves].sort(() => Math.random() - 0.5);

  let bestMove: any = null;
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const m of shuffled) {
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
