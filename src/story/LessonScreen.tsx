import { useCallback, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../ChessBoard';
import type { Lesson } from './content';
import { addXp } from './storyStorage';

interface Props {
  lesson: Lesson;
  onDone: () => void;
  onBack: () => void;
}

export default function LessonScreen({ lesson, onDone, onBack }: Props) {
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = new Chess();
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const game = gameRef.current;

  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const step = lesson.steps[stepIndex];

  const advance = useCallback((fromStep: number) => {
    const current = lesson.steps[fromStep];
    if (current.opponentReplyFrom && current.opponentReplyTo) {
      setTimeout(() => {
        try {
          gameRef.current!.move({ from: current.opponentReplyFrom!, to: current.opponentReplyTo! });
        } catch {
          // ignore, shouldn't happen with well-formed lesson data
        }
        bump();
        if (fromStep + 1 < lesson.steps.length) {
          setStepIndex(fromStep + 1);
        } else {
          setComplete(true);
          addXp(10);
        }
      }, 500);
    } else if (fromStep + 1 < lesson.steps.length) {
      setStepIndex(fromStep + 1);
    } else {
      setComplete(true);
      addXp(10);
    }
  }, [lesson]);

  const handleSquareTap = useCallback((square: string) => {
    if (complete) return;

    if (selected) {
      if (legalMoves.includes(square)) {
        if (selected === step.expectedFrom && square === step.expectedTo) {
          game.move({ from: selected, to: square });
          setSelected(null);
          setLegalMoves([]);
          setFeedback(null);
          bump();
          advance(stepIndex);
        } else {
          setFeedback("Not quite — try again.");
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
  }, [game, selected, legalMoves, step, stepIndex, advance, complete]);

  return (
    <div className="lesson-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>{lesson.title}</h2>
      <p className="lesson-text">
        {complete ? lesson.outro : (stepIndex === 0 && !feedback ? lesson.intro + ' ' : '') + (complete ? '' : step.instruction)}
      </p>
      {feedback && !complete && <p className="lesson-feedback">{feedback}</p>}

      <ChessBoard
        game={game}
        selected={selected}
        legalMoves={legalMoves}
        onSquareTap={handleSquareTap}
      />

      {complete && <button className="play-btn" onClick={onDone}>Continue</button>}
    </div>
  );
}
