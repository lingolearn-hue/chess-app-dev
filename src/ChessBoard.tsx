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
}

export default function ChessBoard({ game, selected, legalMoves, onSquareTap }: Props) {
  const board = useMemo(() => game.board(), [game]);

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
  }, [game, board]);

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

          const classes = [
            'square',
            isLight ? 'light' : 'dark',
            isSelected ? 'selected' : '',
            isLegal ? 'legal' : '',
            isCapture ? 'capture' : '',
            isCheck ? 'check' : '',
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
