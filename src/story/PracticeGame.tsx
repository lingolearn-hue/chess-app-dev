import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../ChessBoard';
import PromotionPicker from '../PromotionPicker';
import { findBestMove, DIFFICULTY_DEPTH } from '../engine';

interface Props {
  title: string;
  objective: string;
  fen: string;
  onBack: () => void;
}

type Status = 'playing' | 'success' | 'failed' | 'draw';

export default function PracticeGame({ title, objective, fen, onBack }: Props) {
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = new Chess(fen);
  const playerColorRef = useRef<'w' | 'b'>(gameRef.current.turn());
  const playerColor = playerColorRef.current;

  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const game = gameRef.current;

  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState<Status>('playing');

  const finalizeMove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    try {
      gameRef.current!.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return;
    }
    setSelected(null);
    setLegalMoves([]);
    bump();
  }, []);

  const handleSquareTap = useCallback((square: string) => {
    if (status !== 'playing' || thinking || pendingPromotion) return;
    if (game.turn() !== playerColor) return;

    if (selected) {
      if (legalMoves.includes(square)) {
        const verboseMoves = game.moves({ square: selected as any, verbose: true }) as any[];
        const match = verboseMoves.find((m) => m.to === square);
        if (match?.promotion) {
          setPendingPromotion({ from: selected, to: square, color: game.turn() });
          return;
        }
        finalizeMove(selected, square);
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
  }, [game, selected, legalMoves, status, thinking, pendingPromotion, finalizeMove, playerColor]);

  const handlePromotionChoice = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    finalizeMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  }, [pendingPromotion, finalizeMove]);

  // Opponent's turn — fixed medium strength, since this position isn't tied to a story character.
  useEffect(() => {
    if (status !== 'playing' || pendingPromotion) return;
    if (gameRef.current!.isGameOver()) return;
    if (gameRef.current!.turn() === playerColor) return;

    setThinking(true);
    const timer = setTimeout(() => {
      const scratch = new Chess(gameRef.current!.fen());
      const mv = findBestMove(scratch, DIFFICULTY_DEPTH.medium);
      setThinking(false);
      if (mv) finalizeMove(mv.from, mv.to, mv.promotion);
    }, 400);
    return () => {
      clearTimeout(timer);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, status, pendingPromotion, playerColor, finalizeMove]);

  // Detect game end.
  useEffect(() => {
    if (status !== 'playing') return;
    if (!gameRef.current!.isGameOver()) return;
    if (gameRef.current!.isCheckmate()) {
      const matedColor = gameRef.current!.turn();
      setStatus(matedColor !== playerColor ? 'success' : 'failed');
    } else {
      setStatus('draw');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, status]);

  const statusText = (() => {
    if (status === 'success') return 'Objective achieved!';
    if (status === 'failed') return 'The position was lost — try again from the library.';
    if (status === 'draw') return 'Drawn — try again for the full objective.';
    return thinking ? 'Opponent is thinking…' : objective;
  })();

  return (
    <div className="lesson-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>{title}</h2>
      <p className="lesson-text">{statusText}</p>

      <ChessBoard
        game={game}
        selected={selected}
        legalMoves={legalMoves}
        onSquareTap={handleSquareTap}
      />

      {pendingPromotion && (
        <PromotionPicker color={pendingPromotion.color} onChoose={handlePromotionChoice} />
      )}

      {status !== 'playing' && <button className="play-btn" onClick={onBack}>Done</button>}
    </div>
  );
}
