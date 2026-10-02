import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../ChessBoard';
import PromotionPicker from '../PromotionPicker';
import Portrait from './Portrait';
import { findMoveForStrength, findBestMove, DIFFICULTY_DEPTH } from '../engine';
import { computeGuardAttackInfo } from '../analysis';
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
  const [ratingCounted, setRatingCounted] = useState(true);

  // Using a hint at any point this game disqualifies it from affecting
  // rating or the win/loss record — tracked for the whole game, not just
  // the move it was used on.
  const [hintEnabled, setHintEnabled] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);

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

  // Hint: recomputed whenever it's the player's (White's) turn and the
  // toggle is on. Toggling it on at all marks this game as hint-assisted.
  useEffect(() => {
    if (phase !== 'playing' || pendingPromotion || thinking) {
      setHintMove(null);
      return;
    }
    if (!hintEnabled || game.turn() !== 'w') {
      setHintMove(null);
      return;
    }
    const scratch = new Chess(game.fen());
    const mv = findBestMove(scratch, DIFFICULTY_DEPTH.medium);
    setHintMove(mv ? { from: mv.from, to: mv.to } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase, pendingPromotion, thinking, hintEnabled]);

  const handleHintToggle = () => {
    setHintEnabled((v) => !v);
    setHintUsed(true);
  };

  // Guard/attack overlay for the player's own (White) pieces, shown whenever
  // the hint toggle is on — useful any time, not just on the player's turn.
  const fenForAnalysis = game.fen();
  const guardAttackInfo = useMemo(
    () => (hintEnabled ? computeGuardAttackInfo(game, 'w') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fenForAnalysis, hintEnabled]
  );

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

    if (hintUsed) {
      // Hints were used this game: no rating or record change, just XP for playing.
      setRatingCounted(false);
      setRatingDelta(0);
    } else {
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
    }
    addXp(r === 'win' ? 20 : 5);

    setPostLine(r === 'win' ? pick(opponent.loseLines) : r === 'loss' ? pick(opponent.winLines) : pick(opponent.drawLines));
    setPhase('post-dialogue');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase]);

  const headerText = (() => {
    if (phase === 'pre-dialogue') return `"${preLine}"`;
    if (phase === 'post-dialogue') return `"${postLine}"`;
    if (thinking) return `${opponent.name} is thinking…`;
    return 'Your move';
  })();

  return (
    <div className="story-game-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>

      {/* Always-present header: the board never shifts when dialogue or
          status text changes, since this row has a fixed reserved height. */}
      <div className="story-game-header">
        <Portrait opponent={opponent} size="small" expression={result === 'win' ? 'sad' : result === 'loss' ? 'happy' : 'neutral'} />
        <div className="story-game-header-text">
          <span className="story-game-opponent-name">{opponent.name}</span>
          <span className="lesson-text">{headerText}</span>
        </div>
        {phase === 'playing' && (
          <button
            className={`hint-toggle-btn ${hintEnabled ? 'hint-btn-active' : ''}`}
            onClick={handleHintToggle}
            title="Hints disable rating/record changes for this game"
          >
            💡 Hint
          </button>
        )}
      </div>

      <ChessBoard
        game={game}
        selected={selected}
        legalMoves={legalMoves}
        onSquareTap={handleSquareTap}
        hintFrom={hintMove?.from}
        hintTo={hintMove?.to}
        analysisLines={guardAttackInfo?.lines}
        analysisTint={guardAttackInfo?.tint}
      />

      {pendingPromotion && (
        <PromotionPicker color={pendingPromotion.color} onChoose={handlePromotionChoice} />
      )}

      {phase === 'pre-dialogue' && (
        <div className="dialogue-overlay">
          <div className="dialogue-panel">
            <button className="play-btn" onClick={() => setPhase('playing')}>Begin</button>
          </div>
        </div>
      )}

      {phase === 'post-dialogue' && (
        <div className="dialogue-overlay">
          <div className="dialogue-panel">
            <p className="rating-change">
              {result === 'win' ? 'You won!' : result === 'loss' ? 'You lost.' : 'Draw.'}{' '}
              {ratingCounted
                ? `Rating: ${playerRating - ratingDelta} → ${playerRating} (${ratingDelta >= 0 ? '+' : ''}${ratingDelta})`
                : 'Hints were used — no rating or record change this game.'}
            </p>
            <button className="play-btn" onClick={onDone}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
