import { useMemo } from 'react';
import type { Chess, Square as ChessSquare } from 'chess.js';
import PieceIcon from './PieceIcon';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

interface Props {
  game: Chess;
  selected: string | null;
  legalMoves: string[];
  onSquareTap: (square: string) => void;
  hintFrom?: string | null;
  hintTo?: string | null;
}

export default function ChessBoard({ game, selected, legalMoves, onSquareTap, hintFrom, hintTo }: Props) {
  // `game` is a single mutated-in-place Chess instance (see App.tsx), so its
  // object reference never changes between moves. Depending on `game` alone
  // means this memo would never recompute after the first render. Depending
  // on the FEN string instead correctly invalidates whenever the position changes.
  const fen = game.fen();
  const board = useMemo(() => game.board(), [fen]);

  const inCheckSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    const turn = game.turn();
    for (const row of board) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === turn) {
          return cell.square;
        }
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, board]);

  return (
    <div className="board">
      {RANKS.map((rank, rIdx) =>
        FILES.map((file, fIdx) => {
          const square = `${file}${rank}` as ChessSquare;
          const piece = board[rIdx][fIdx];
          const isLight = (rIdx + fIdx) % 2 === 0;
          const isSelected = selected === square;
          const isLegal = legalMoves.includes(square);
          const isCheck = inCheckSquare === square;
          const isCapture = isLegal && !!piece;
          const isHint = hintFrom === square || hintTo === square;

          const classes = [
            'square',
            isLight ? 'light' : 'dark',
            isSelected ? 'selected' : '',
            isLegal ? 'legal' : '',
            isCapture ? 'capture' : '',
            isCheck ? 'check' : '',
            isHint ? 'hint' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={square} className={classes} onClick={() => onSquareTap(square)}>
              {piece && (
                <span className={`piece ${piece.color}`}>
                  <PieceIcon type={piece.type as any} color={piece.color as 'w' | 'b'} />
                </span>
              )}
              {isLegal && !piece && <span className="move-dot" />}
            </div>
          );
        })
      )}
    </div>
  );
}
