import { useLayoutEffect, useMemo, useRef } from 'react';
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
  bloodMap?: Map<string, Array<'w' | 'b'>>;
  lastMove?: { from: string; to: string } | null;
  analysisLines?: Array<{ from: string; to: string; kind: 'defend' | 'attack' }>;
  analysisTint?: Map<string, 'blue' | 'red'>;
}

// Deterministic pseudo-random index (0-3) per square (and capture layer), so
// repeated captures on the same square get visibly different patterns
// instead of stacking identically on top of each other.
function patternIndex(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % 4;
}

function fileIndex(square: string): number {
  return FILES.indexOf(square[0]);
}
function rankIndex(square: string): number {
  return RANKS.indexOf(square[1]);
}
function squareCenterPercent(square: string): { x: number; y: number } {
  return { x: (fileIndex(square) + 0.5) * 12.5, y: (rankIndex(square) + 0.5) * 12.5 };
}

export default function ChessBoard({
  game,
  selected,
  legalMoves,
  onSquareTap,
  hintFrom,
  hintTo,
  bloodMap,
  lastMove,
  analysisLines,
  analysisTint,
}: Props) {
  // `game` is a single mutated-in-place Chess instance (see App.tsx), so its
  // object reference never changes between moves. Depending on `game` alone
  // means this memo would never recompute after the first render. Depending
  // on the FEN string instead correctly invalidates whenever the position changes.
  const fen = game.fen();
  const board = useMemo(() => game.board(), [fen]);
  const boardRef = useRef<HTMLDivElement>(null);

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

  // Slide the piece that just moved from its old square into its new one,
  // so a move is clearly visible even on a quick glance, not just inferred
  // from the before/after position.
  useLayoutEffect(() => {
    if (!lastMove || !boardRef.current) return;
    const el = boardRef.current.querySelector<HTMLElement>(
      `[data-square="${lastMove.to}"] .piece`
    );
    if (!el) return;

    const cell = boardRef.current.clientWidth / 8;
    const dx = (fileIndex(lastMove.from) - fileIndex(lastMove.to)) * cell;
    const dy = (rankIndex(lastMove.from) - rankIndex(lastMove.to)) * cell;
    const isBlack = el.classList.contains('b');
    const restingRotate = isBlack ? 'rotate(180deg)' : '';

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px) ${restingRotate}`;
    // Force layout so the browser registers the start position before the
    // transition below is applied, otherwise both would collapse into one frame.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;
    el.style.transition = 'transform 180ms ease-out';
    el.style.transform = `translate(0, 0) ${restingRotate}`;
  }, [lastMove, fen]);

  return (
    <div className="board" ref={boardRef}>
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
          const isLastMove = lastMove?.from === square || lastMove?.to === square;
          const bloodEvents = bloodMap?.get(square) ?? [];
          const tint = analysisTint?.get(square);

          const classes = [
            'square',
            isLight ? 'light' : 'dark',
            isSelected ? 'selected' : '',
            isLegal ? 'legal' : '',
            isCapture ? 'capture' : '',
            isCheck ? 'check' : '',
            isHint ? 'hint' : '',
            isLastMove ? 'last-move' : '',
            tint ? `tint-${tint}` : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={square} data-square={square} className={classes} onClick={() => onSquareTap(square)}>
              {bloodEvents.map((color, i) => (
                <span
                  key={i}
                  className={`blood-layer blood-${color} blood-p${patternIndex(square + i)}`}
                />
              ))}
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

      {analysisLines && analysisLines.length > 0 && (
        <svg className="analysis-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
          {analysisLines.map((line, i) => {
            const from = squareCenterPercent(line.from);
            const to = squareCenterPercent(line.to);
            return (
              <line
                key={i}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={`analysis-line analysis-line-${line.kind}`}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
