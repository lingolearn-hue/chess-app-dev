import { useCallback, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../ChessBoard';
import type { Puzzle } from './content';
import { addXp } from './storyStorage';

interface Props {
  puzzle: Puzzle;
  onDone: () => void;
  onBack: () => void;
}

export default function PuzzleScreen({ puzzle, onDone, onBack }: Props) {
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = new Chess(puzzle.fen);
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const game = gameRef.current;

  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  const handleSquareTap = useCallback((square: string) => {
    if (solved) return;

    if (selected) {
      if (legalMoves.includes(square)) {
        if (selected === puzzle.solutionFrom && square === puzzle.solutionTo) {
          game.move({ from: selected, to: square });
          setSelected(null);
          setLegalMoves([]);
          setFeedback(null);
          setSolved(true);
          bump();
          addXp(10);
        } else {
          setFeedback('Not the strongest move — try again.');
          setSelected(null);
          setLegalMoves([]);
        }
        return;
      }
      const piece = game.get(square as any);
      if (piece && piece.color === game.turn()) {
        const moves = game.moves({ square: square as any, verbose: true }) as any[];
        setSelected(square);
        setLegalMoves(moves.map((m) => m.to));
        return;
      }
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    const piece = game.get(square as any);
    if (piece && piece.color === game.turn()) {
      const moves = game.moves({ square: square as any, verbose: true }) as any[];
      setSelected(square);
      setLegalMoves(moves.map((m) => m.to));
    }
  }, [game, selected, legalMoves, puzzle, solved]);

  return (
    <div className="lesson-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>{puzzle.title}</h2>
      <p className="lesson-text">{solved ? puzzle.successText : puzzle.instruction}</p>
      {feedback && !solved && <p className="lesson-feedback">{feedback}</p>}

      <ChessBoard
        game={game}
        selected={selected}
        legalMoves={legalMoves}
        onSquareTap={handleSquareTap}
      />

      {solved && <button className="play-btn" onClick={onDone}>Continue</button>}
    </div>
  );
}
