import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../ChessBoard';
import PromotionPicker from '../PromotionPicker';
import PieceIcon from '../PieceIcon';
import { findMoveForStrength } from '../engine';
import type { Opponent } from './opponents';
import { expectedScore, updateRating } from './rating';
import { loadPlayerRating, savePlayerRating, loadOpponentRecord, saveOpponentRecord, addXp } from './storyStorage';

interface Props {
  opponent: Opponent;
  onDone: () => void;
  onBack: () => void;
}

type Phase = 'pre-dialogue' | 'playing' | 'post-dialogue';
type Result = 'win' | 'loss' | 'draw' | null;

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export default function StoryGame({ opponent, onDone, onBack }: Props) {
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = new Chess();
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const game = gameRef.current;

  const [phase, setPhase] = useState<Phase>('pre-dialogue');
  const [preLine] = useState(() => pick(opponent.preGameLines));
  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [postLine, setPostLine] = useState('');
  const [ratingDelta, setRatingDelta] = useState(0);
  const [playerRating, setPlayerRating] = useState(() => loadPlayerRating());

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
    if (phase !== 'playing' || thinking || pendingPromotion) return;
    if (game.turn() === 'b') return; // computer's turn

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
  }, [game, selected, legalMoves, phase, thinking, pendingPromotion, finalizeMove]);

  const handlePromotionChoice = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    finalizeMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  }, [pendingPromotion, finalizeMove]);

  // Computer's turn (standard rules here — no house-rule king-capture finish;
  // this mode ends normally at checkmate/stalemate/draw).
  useEffect(() => {
    if (phase !== 'playing' || pendingPromotion) return;
    if (gameRef.current!.isGameOver()) return;
    if (gameRef.current!.turn() !== 'b') return;

    setThinking(true);
    const timer = setTimeout(() => {
      const scratch = new Chess(gameRef.current!.fen());
      const mv = findMoveForStrength(scratch, opponent.engineStrength);
      setThinking(false);
      if (mv) finalizeMove(mv.from, mv.to, mv.promotion);
    }, 400);
    return () => {
      clearTimeout(timer);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase, pendingPromotion, opponent.engineStrength, finalizeMove]);

  // Detect game end and settle the result once.
  useEffect(() => {
    if (phase !== 'playing') return;
    if (!gameRef.current!.isGameOver()) return;

    let r: Result;
    if (gameRef.current!.isCheckmate()) {
      r = gameRef.current!.turn() === 'b' ? 'win' : 'loss'; // black mated -> player (white) wins
    } else {
      r = 'draw';
    }
    setResult(r);

    const actual = r === 'win' ? 1 : r === 'draw' ? 0.5 : 0;
    const expected = expectedScore(playerRating, opponent.rating);
    const newRating = updateRating(playerRating, expected, actual);
    setRatingDelta(newRating - playerRating);
    setPlayerRating(newRating);
    savePlayerRating(newRating);

    const record = loadOpponentRecord(opponent.id);
    if (r === 'win') record.wins += 1;
    else if (r === 'loss') record.losses += 1;
    else record.draws += 1;
    saveOpponentRecord(opponent.id, record);
    addXp(r === 'win' ? 20 : 5);

    setPostLine(r === 'win' ? pick(opponent.loseLines) : r === 'loss' ? pick(opponent.winLines) : pick(opponent.drawLines));
    setPhase('post-dialogue');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase]);

  return (
    <div className="story-game-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>

      {phase === 'pre-dialogue' && (
        <div className="dialogue-panel">
          <div className="opponent-portrait small" style={{ background: opponent.color }}>
            <PieceIcon type={opponent.pieceTheme} color="w" />
          </div>
          <p className="dialogue-line">"{preLine}"</p>
          <button className="play-btn" onClick={() => setPhase('playing')}>Begin</button>
        </div>
      )}

      {phase !== 'pre-dialogue' && (
        <>
          <p className="lesson-text">
            {phase === 'playing' ? (thinking ? `${opponent.name} is thinking…` : 'Your move') : null}
          </p>
          <ChessBoard
            game={game}
            selected={selected}
            legalMoves={legalMoves}
            onSquareTap={handleSquareTap}
          />
        </>
      )}

      {pendingPromotion && (
        <PromotionPicker color={pendingPromotion.color} onChoose={handlePromotionChoice} />
      )}

      {phase === 'post-dialogue' && (
        <div className="dialogue-panel">
          <div className="opponent-portrait small" style={{ background: opponent.color }}>
            <PieceIcon type={opponent.pieceTheme} color="w" />
          </div>
          <p className="dialogue-line">"{postLine}"</p>
          <p className="rating-change">
            {result === 'win' ? 'You won!' : result === 'loss' ? 'You lost.' : 'Draw.'}{' '}
            Rating: {playerRating - ratingDelta} → {playerRating} ({ratingDelta >= 0 ? '+' : ''}{ratingDelta})
          </p>
          <button className="play-btn" onClick={onDone}>Continue</button>
        </div>
      )}
    </div>
  );
}
