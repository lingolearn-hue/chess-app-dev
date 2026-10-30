import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import { ClockDisplay, useClockTicker } from './Clock';
import CapturedPieces from './CapturedPieces';
import PromotionPicker from './PromotionPicker';
import { findBestMove, DIFFICULTY_DEPTH } from './engine';
import { computeGuardAttackInfo } from './analysis';
import { saveFen, loadFen, clearFen } from './storage';
import type { SoundLink } from './link/audio';
import { packMove, unpackMove, squareToIndex, indexToSquare } from './link/codec';
import './TwoPlayerApp.css';

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const TIME_CONTROLS = [5, 10, 15] as const;
const DEFAULT_MINUTES = 10;

type Difficulty = 'easy' | 'medium' | 'hard';

function createGame(remote: boolean): Chess {
  const saved = remote ? null : loadFen();
  const game = new Chess();
  if (saved) {
    try {
      game.load(saved);
    } catch {
      // corrupt save, start fresh
    }
  }
  return game;
}

interface PendingPromotion {
  from: string;
  to: string;
  color: 'w' | 'b';
}

interface GameOverState {
  winner: 'white' | 'black' | null;
  reason: string;
}

// After a move delivers checkmate, the game isn't over yet: the mated king
// is still on the board and must actually be captured, by tapping one of
// the checking pieces and then the king square, exactly like any other move.
interface FinishingMate {
  winnerColor: 'w' | 'b';
  kingSquare: string;
  attackerSquares: string[];
}

interface CaptureEvent {
  square: string; // where the captured piece actually sat
  type: string; // captured piece type letter
  color: 'w' | 'b'; // color of the captured piece
}

// Before the winner gets to finish, the mated side gets one desperate turn:
// if their king is adjacent to one of the checking pieces, they may capture
// it — even though that would normally be illegal (it may leave the king
// still in check from another piece). If a "covering" piece defends the
// square the king lands on, the winner then finishes with that specific
// piece instead of any attacker.
interface LosingSideCounter {
  matedColor: 'w' | 'b';
  kingSquare: string;
  killableCheckers: string[];
}

function chebyshevDistance(a: string, b: string): number {
  const af = a.charCodeAt(0) - 'a'.charCodeAt(0);
  const ar = a.charCodeAt(1) - '1'.charCodeAt(0);
  const bf = b.charCodeAt(0) - 'a'.charCodeAt(0);
  const br = b.charCodeAt(1) - '1'.charCodeAt(0);
  return Math.max(Math.abs(af - bf), Math.abs(ar - br));
}

type Phase = 'setup' | 'playing';

// Two-devices mode: each phone shows its own side at the bottom and
// exchanges actions over the sound link. All actions (including the
// house-rule mate sequence) go through the same functions as local taps.
export interface RemoteConfig {
  link: SoundLink;
  myColor: 'w' | 'b';
  minutes: number;
}

interface Props {
  onBack?: () => void;
  remote?: RemoteConfig;
}

export default function TwoPlayerApp({ onBack, remote }: Props) {
  // A single mutable Chess instance lives for the whole game so its internal
  // move history (needed for the captured-pieces list) is never lost.
  // Re-creating a Chess object from FEN on every move drops that history,
  // since FEN encodes only the current position, not how it was reached.
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = createGame(!!remote);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const game = gameRef.current;

  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [finishingMate, setFinishingMate] = useState<FinishingMate | null>(null);
  const [losingSideCounter, setLosingSideCounter] = useState<LosingSideCounter | null>(null);
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);
  const [hintEnabled, setHintEnabled] = useState<{ w: boolean; b: boolean }>({ w: false, b: false });
  const [thinking, setThinking] = useState(false);
  // Tracked independently of chess.js's own history: the finishing king
  // capture replaces gameRef.current with a fresh instance (see below), which
  // would otherwise silently drop all earlier captures from this list.
  const [captureLog, setCaptureLog] = useState<CaptureEvent[]>([]);

  // New games start in 'setup' phase: time control, opponent type, and the
  // handicap piece-removal function can only be adjusted here, before play begins.
  const startMinutes = remote ? remote.minutes : DEFAULT_MINUTES;
  const [phase, setPhase] = useState<Phase>('playing');
  const [setupMinutes, setSetupMinutes] = useState<number>(startMinutes);
  const [setupVsComputer, setSetupVsComputer] = useState(false);
  const [setupComputerColor, setSetupComputerColor] = useState<'w' | 'b'>('b');
  const [setupDifficulty, setSetupDifficulty] = useState<Difficulty>('medium');

  const [minutes, setMinutes] = useState<number>(startMinutes);
  const [vsComputer, setVsComputer] = useState(false);
  const [computerColor, setComputerColor] = useState<'w' | 'b'>('b');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const [whiteSeconds, setWhiteSeconds] = useState(startMinutes * 60);
  const [blackSeconds, setBlackSeconds] = useState(startMinutes * 60);
  const [active, setActive] = useState<'white' | 'black' | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (remote) return;
    saveFen(game.fen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const handleTick = useCallback((): 'white' | 'black' | null => {
    let flagged: 'white' | 'black' | null = null;
    if (active === 'white') {
      setWhiteSeconds((s) => {
        if (s <= 1) { flagged = 'white'; return 0; }
        return s - 1;
      });
    } else if (active === 'black') {
      setBlackSeconds((s) => {
        if (s <= 1) { flagged = 'black'; return 0; }
        return s - 1;
      });
    }
    return flagged;
  }, [active]);

  const handleFlagFall = useCallback((color: 'white' | 'black') => {
    setActive(null);
    setPaused(true);
    // eslint-disable-next-line no-alert
    alert(`${color === 'white' ? 'White' : 'Black'} ran out of time.`);
  }, []);

  useClockTicker({
    active,
    paused: paused || !!gameOver || phase === 'setup',
    onTick: handleTick,
    onFlagFall: handleFlagFall,
  });

  // ---- Two-devices plumbing ----
  const [linkState, setLinkState] = useState<'ok' | 'sending' | 'failed'>('ok');
  const [drawOffered, setDrawOffered] = useState(false); // incoming offer from the opponent
  const [drawPending, setDrawPending] = useState(false); // our own offer awaiting an answer
  const sendChain = useRef<Promise<void>>(Promise.resolve());
  const failedSend = useRef<{ type: Parameters<SoundLink['sendReliable']>[0]; payload: number[] } | null>(null);
  const secondsRef = useRef({ w: whiteSeconds, b: blackSeconds });
  secondsRef.current = { w: whiteSeconds, b: blackSeconds };

  const enqueueSend = useCallback((type: Parameters<SoundLink['sendReliable']>[0], payload: number[]) => {
    if (!remote) return;
    sendChain.current = sendChain.current.then(async () => {
      setLinkState('sending');
      const attempts = await remote.link.sendReliable(type, payload);
      if (attempts > 0) {
        failedSend.current = null;
        setLinkState('ok');
      } else {
        failedSend.current = { type, payload };
        setLinkState('failed');
      }
    });
  }, [remote]);

  const sendMove = useCallback((from: string, to: string, promotion?: string) => {
    if (!remote) return;
    // Clock value after this move; the opponent adopts it for our side.
    enqueueSend('move', packMove(squareToIndex(from), squareToIndex(to), promotion, secondsRef.current[remote.myColor]));
  }, [remote, enqueueSend]);

  const finalizeMove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    let moveResult: any;
    try {
      moveResult = gameRef.current!.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return;
    }
    if (moveResult?.captured) {
      // En passant captures a pawn that isn't actually on the destination square.
      const captureSquare = moveResult.flags?.includes('e')
        ? `${to[0]}${from[1]}`
        : to;
      const capturedColor: 'w' | 'b' = moveResult.color === 'w' ? 'b' : 'w';
      setCaptureLog((log) => [...log, { square: captureSquare, type: moveResult.captured, color: capturedColor }]);
    }
    setSelected(null);
    setLegalMoves([]);
    setHintMove(null);
    setLastMove({ from, to });

    // Checkmate doesn't end the game by itself: the mated king is still on
    // the board. The winner must still tap a checking piece, then the king
    // square, to actually capture it — a real move, not an automatic step.
    if (gameRef.current!.isCheckmate()) {
      const matedColor = gameRef.current!.turn();
      const winnerColor = matedColor === 'w' ? 'b' : 'w';
      const fenParts = gameRef.current!.fen().split(' ');
      fenParts[1] = winnerColor;
      const scratch = new Chess(fenParts.join(' '));
      let kingSquare: string | null = null;
      for (const row of scratch.board()) {
        for (const cell of row) {
          if (cell && cell.type === 'k' && cell.color === matedColor) kingSquare = cell.square;
        }
      }
      const attackerSquares = kingSquare
        ? (scratch.moves({ verbose: true }) as any[])
            .filter((m) => m.to === kingSquare)
            .map((m) => m.from)
        : [];
      if (kingSquare && attackerSquares.length > 0) {
        // Does the mated king stand adjacent to (at least one of) the
        // checking pieces? If so, the mated side gets a turn to try
        // capturing it with the king before the winner finishes.
        const killableCheckers = attackerSquares.filter((sq) => chebyshevDistance(kingSquare!, sq) === 1);
        if (killableCheckers.length > 0) {
          setLosingSideCounter({ matedColor, kingSquare, killableCheckers });
          setActive(matedColor === 'w' ? 'white' : 'black'); // it's the mated side's turn to act
        } else {
          setFinishingMate({ winnerColor, kingSquare, attackerSquares });
          setActive(winnerColor === 'w' ? 'white' : 'black');
        }
      } else {
        // Fallback safety net, should not normally occur.
        setActive(null);
        setGameOver({ winner: winnerColor === 'w' ? 'white' : 'black', reason: 'checkmate' });
      }
    } else {
      setActive(gameRef.current!.turn() === 'w' ? 'white' : 'black');
    }
    bump();
  }, []);

  // Executes the winner's final capturing move against the mated king.
  const finalizeKingCapture = useCallback((from: string, to: string) => {
    if (!finishingMate) return;
    const fenParts = gameRef.current!.fen().split(' ');
    fenParts[1] = finishingMate.winnerColor;
    const scratch = new Chess(fenParts.join(' '));
    let moveResult: any;
    try {
      moveResult = scratch.move({ from, to });
    } catch {
      return;
    }
    if (moveResult?.captured) {
      const capturedColor: 'w' | 'b' = finishingMate.winnerColor === 'w' ? 'b' : 'w';
      setCaptureLog((log) => [...log, { square: to, type: moveResult.captured, color: capturedColor }]);
    }
    gameRef.current = scratch;
    setActive(null);
    setSelected(null);
    setLegalMoves([]);
    setLastMove({ from, to });
    setGameOver({
      winner: finishingMate.winnerColor === 'w' ? 'white' : 'black',
      reason: 'checkmate',
    });
    setFinishingMate(null);
    bump();
  }, [finishingMate]);

  // The mated king captures one of the adjacent checking pieces. This is
  // normally illegal (it can leave the king in check), which is exactly the
  // point — it's the losing side's one desperate counter-attack. If another
  // enemy piece still covers the square afterward, the winner finishes with
  // that specific piece; otherwise the check is genuinely broken and play continues.
  const handleKingCounterAttack = useCallback((checkerSquare: string) => {
    if (!losingSideCounter) return;
    const { matedColor, kingSquare } = losingSideCounter;
    const winnerColor = matedColor === 'w' ? 'b' : 'w';

    const checkerPiece = gameRef.current!.get(checkerSquare as any);
    if (checkerPiece) {
      setCaptureLog((log) => [...log, { square: checkerSquare, type: checkerPiece.type, color: checkerPiece.color }]);
    }

    const next = new Chess(gameRef.current!.fen());
    next.remove(kingSquare as any);
    next.remove(checkerSquare as any);
    next.put({ type: 'k', color: matedColor }, checkerSquare as any);

    // Check whether any other enemy piece still attacks the king's new square.
    const checkFenParts = next.fen().split(' ');
    checkFenParts[1] = winnerColor;
    const checkScratch = new Chess(checkFenParts.join(' '));
    const coveringSquares = (checkScratch.moves({ verbose: true }) as any[])
      .filter((m) => m.to === checkerSquare)
      .map((m) => m.from);

    setSelected(null);
    setLegalMoves([]);
    setLastMove({ from: kingSquare, to: checkerSquare });
    setLosingSideCounter(null);

    if (coveringSquares.length > 0) {
      gameRef.current = next;
      setFinishingMate({ winnerColor, kingSquare: checkerSquare, attackerSquares: coveringSquares });
      setActive(winnerColor === 'w' ? 'white' : 'black');
    } else {
      // A genuine escape: the king broke the check entirely. Play continues normally.
      const finalFenParts = next.fen().split(' ');
      finalFenParts[1] = winnerColor;
      finalFenParts[3] = '-'; // clear any stale en-passant target
      gameRef.current = new Chess(finalFenParts.join(' '));
      setActive(winnerColor === 'w' ? 'white' : 'black');
    }
    bump();
  }, [losingSideCounter]);

  const handleRemovePiece = useCallback((square: string) => {
    const piece = gameRef.current!.get(square as any);
    if (!piece || piece.type === 'k') return; // kings can't be handicap-removed
    // Handicap removals show up in the captured-pieces row from the start,
    // as if that piece had already been taken off the board.
    setCaptureLog((log) => [...log, { square, type: piece.type, color: piece.color }]);
    gameRef.current!.remove(square as any);
    bump();
  }, []);

  const handleSquareTap = useCallback((square: string) => {
    if (phase === 'setup') {
      handleRemovePiece(square);
      return;
    }

    if (losingSideCounter) {
      if (remote && losingSideCounter.matedColor !== remote.myColor) return;
      if (selected === losingSideCounter.kingSquare && losingSideCounter.killableCheckers.includes(square)) {
        sendMove(selected, square);
        handleKingCounterAttack(square);
        return;
      }
      if (square === losingSideCounter.kingSquare) {
        setSelected(square);
        setLegalMoves(losingSideCounter.killableCheckers);
        return;
      }
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    if (finishingMate) {
      if (remote && finishingMate.winnerColor !== remote.myColor) return;
      if (selected && square === finishingMate.kingSquare) {
        sendMove(selected, square);
        finalizeKingCapture(selected, square);
        return;
      }
      if (finishingMate.attackerSquares.includes(square)) {
        setSelected(square);
        setLegalMoves([finishingMate.kingSquare]);
        return;
      }
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    if (gameOver || pendingPromotion || thinking) return;
    if (vsComputer && game.turn() === computerColor) return; // wait for the computer's move
    if (remote && game.turn() !== remote.myColor) return; // opponent's turn

    if (selected) {
      if (legalMoves.includes(square)) {
        const verboseMoves = game.moves({ square: selected as any, verbose: true }) as any[];
        const match = verboseMoves.find((m) => m.to === square);
        if (match?.promotion) {
          setPendingPromotion({ from: selected, to: square, color: game.turn() });
          return;
        }
        sendMove(selected, square);
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
  }, [game, selected, legalMoves, pendingPromotion, finalizeMove, sendMove, remote, phase, handleRemovePiece, gameOver, finishingMate, finalizeKingCapture, vsComputer, computerColor, thinking, losingSideCounter, handleKingCounterAttack]);

  const handlePromotionChoice = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    sendMove(pendingPromotion.from, pendingPromotion.to, piece);
    finalizeMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  }, [pendingPromotion, finalizeMove, sendMove]);

  // ---- Incoming frames from the opponent ----
  const [inbox, setInbox] = useState<Array<{ from: string; to: string; promotion?: string; secs: number }>>([]);
  useEffect(() => {
    if (!remote) return;
    const prev = remote.link.ev;
    remote.link.ev = {
      ...prev,
      onFrame: (f) => {
        if (f.type === 'move') {
          const m = unpackMove(f.payload);
          setInbox((q) => [...q, { from: indexToSquare(m.from), to: indexToSquare(m.to), promotion: m.promotion, secs: m.secs }]);
        } else if (f.type === 'resign') {
          setActive(null);
          setGameOver({ winner: remote.myColor === 'w' ? 'white' : 'black', reason: 'resignation' });
        } else if (f.type === 'drawOffer') {
          setDrawOffered(true);
        } else if (f.type === 'drawAccept') {
          setDrawPending(false);
          setActive(null);
          setGameOver({ winner: null, reason: 'agreement' });
        } else if (f.type === 'drawDecline') {
          setDrawPending(false);
        }
      },
    };
    return () => {
      remote.link.ev = prev;
    };
  }, [remote]);

  // Apply the opponent's actions one at a time, in whichever house-rule
  // state the game is currently in (same state on both phones).
  useEffect(() => {
    if (!remote || inbox.length === 0) return;
    const m = inbox[0];
    setInbox((q) => q.slice(1));
    if (gameOver) return;
    const opp: 'w' | 'b' = remote.myColor === 'w' ? 'b' : 'w';
    if (losingSideCounter) {
      if (losingSideCounter.matedColor === opp && m.from === losingSideCounter.kingSquare) handleKingCounterAttack(m.to);
      return;
    }
    if (finishingMate) {
      if (finishingMate.winnerColor === opp) finalizeKingCapture(m.from, m.to);
      return;
    }
    if (gameRef.current!.turn() !== opp) return; // duplicate / out-of-turn: ignore
    finalizeMove(m.from, m.to, m.promotion as 'q' | 'r' | 'b' | 'n' | undefined);
    // Adopt the mover's own clock reading.
    if (opp === 'w') setWhiteSeconds(m.secs);
    else setBlackSeconds(m.secs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox]);

  // Computer's turn: think for a moment, then play a move via the normal path.
  useEffect(() => {
    if (phase !== 'playing') return;
    if (gameOver || finishingMate || pendingPromotion || losingSideCounter) return;
    if (!vsComputer) return;
    if (gameRef.current!.turn() !== computerColor) return;

    setThinking(true);
    const timer = setTimeout(() => {
      const scratch = new Chess(gameRef.current!.fen());
      const mv = findBestMove(scratch, DIFFICULTY_DEPTH[difficulty]);
      setThinking(false);
      if (mv) finalizeMove(mv.from, mv.to, mv.promotion);
    }, 400);
    return () => {
      clearTimeout(timer);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase, vsComputer, computerColor, difficulty, gameOver, finishingMate, pendingPromotion, losingSideCounter]);

  // If the computer delivers checkmate, it finishes the game itself —
  // there's no human at that seat to make the finishing tap.
  useEffect(() => {
    if (!finishingMate || !vsComputer || finishingMate.winnerColor !== computerColor) return;
    const timer = setTimeout(() => {
      finalizeKingCapture(finishingMate.attackerSquares[0], finishingMate.kingSquare);
    }, 500);
    return () => clearTimeout(timer);
  }, [finishingMate, vsComputer, computerColor, finalizeKingCapture]);

  // If the computer is the mated side, it decides its own counter-attack —
  // there's no human there to tap it. It prefers a checker whose capture
  // fully breaks the check (no covering piece left); otherwise any choice
  // leads to the same outcome, so it just picks the first.
  useEffect(() => {
    if (!losingSideCounter || !vsComputer || losingSideCounter.matedColor !== computerColor) return;
    const timer = setTimeout(() => {
      const { matedColor, kingSquare, killableCheckers } = losingSideCounter;
      const winnerColor = matedColor === 'w' ? 'b' : 'w';
      let bestChoice = killableCheckers[0];
      for (const checkerSquare of killableCheckers) {
        const next = new Chess(gameRef.current!.fen());
        next.remove(kingSquare as any);
        next.remove(checkerSquare as any);
        next.put({ type: 'k', color: matedColor }, checkerSquare as any);
        const checkFenParts = next.fen().split(' ');
        checkFenParts[1] = winnerColor;
        const checkScratch = new Chess(checkFenParts.join(' '));
        const stillCovered = (checkScratch.moves({ verbose: true }) as any[]).some((m) => m.to === checkerSquare);
        if (!stillCovered) {
          bestChoice = checkerSquare;
          break;
        }
      }
      handleKingCounterAttack(bestChoice);
    }, 500);
    return () => clearTimeout(timer);
  }, [losingSideCounter, vsComputer, computerColor, handleKingCounterAttack]);

  // A player's hint preference persists across their turns: once toggled on
  // for a side, it stays on (recomputing the suggestion fresh) every time
  // the turn comes back to them, until they toggle it off again.
  useEffect(() => {
    if (phase !== 'playing' || gameOver || finishingMate || losingSideCounter || pendingPromotion || thinking) {
      setHintMove(null);
      return;
    }
    const turn = gameRef.current!.turn();
    if (!hintEnabled[turn] || (vsComputer && computerColor === turn) || (remote && remote.myColor !== turn)) {
      setHintMove(null);
      return;
    }
    const scratch = new Chess(gameRef.current!.fen());
    const mv = findBestMove(scratch, DIFFICULTY_DEPTH[difficulty]);
    setHintMove(mv ? { from: mv.from, to: mv.to } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase, gameOver, finishingMate, losingSideCounter, pendingPromotion, thinking, hintEnabled, vsComputer, computerColor, difficulty]);

  const handleHintToggle = (side: 'w' | 'b') => {
    setHintEnabled((prev) => ({ ...prev, [side]: !prev[side] }));
  };

  const handleOpenSetup = () => {
    clearFen();
    gameRef.current = new Chess();
    setSelected(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    setGameOver(null);
    setFinishingMate(null);
    setLosingSideCounter(null);
    setHintMove(null);
    setHintEnabled({ w: false, b: false });
    setThinking(false);
    setCaptureLog([]);
    setLastMove(null);
    setSetupMinutes(minutes);
    setSetupVsComputer(vsComputer);
    setSetupComputerColor(computerColor);
    setSetupDifficulty(difficulty);
    setActive(null);
    setPaused(false);
    setPhase('setup');
    bump();
  };

  const handleStartGame = () => {
    setMinutes(setupMinutes);
    setWhiteSeconds(setupMinutes * 60);
    setBlackSeconds(setupMinutes * 60);
    setVsComputer(setupVsComputer);
    setComputerColor(setupComputerColor);
    setDifficulty(setupDifficulty);
    setActive(null);
    setPhase('playing');
  };

  const handlePauseToggle = () => setPaused((p) => !p);

  // Derive captured pieces (in the order captured) + material advantage from the capture log.
  const capturedBlack: string[] = []; // black pieces captured, i.e. White's trophies
  const capturedWhite: string[] = []; // white pieces captured, i.e. Black's trophies
  for (const c of captureLog) {
    if (c.color === 'b') capturedBlack.push(c.type);
    else capturedWhite.push(c.type);
  }
  const whiteAdvantage =
    capturedBlack.reduce((sum, t) => sum + (PIECE_VALUE[t] ?? 0), 0) -
    capturedWhite.reduce((sum, t) => sum + (PIECE_VALUE[t] ?? 0), 0);
  const blackAdvantage = -whiteAdvantage;
  const bloodMap = new Map<string, Array<'w' | 'b'>>();
  for (const c of captureLog) {
    const existing = bloodMap.get(c.square);
    if (existing) existing.push(c.color);
    else bloodMap.set(c.square, [c.color]);
  }

  // Guard/attack overlay: shown for whichever side(s) have their hint
  // toggle on, regardless of whose turn it is — it's useful at any point,
  // not just while deciding a move. Memoized so it only recomputes when the
  // position or toggle state actually changes, not on every clock tick.
  const fenForAnalysis = game.fen();
  const guardAttackW = useMemo(
    () => (hintEnabled.w ? computeGuardAttackInfo(game, 'w') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fenForAnalysis, hintEnabled.w]
  );
  const guardAttackB = useMemo(
    () => (hintEnabled.b ? computeGuardAttackInfo(game, 'b') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fenForAnalysis, hintEnabled.b]
  );
  const analysisLines = [...(guardAttackW?.lines ?? []), ...(guardAttackB?.lines ?? [])];
  const analysisTint = new Map([...(guardAttackW?.tint ?? []), ...(guardAttackB?.tint ?? [])]);

  const status = (() => {
    if (phase === 'setup') return 'Setting up new game';
    if (gameOver) {
      if (!gameOver.winner) return `Draw by ${gameOver.reason}`;
      return `${gameOver.winner === 'white' ? 'White' : 'Black'} wins by ${gameOver.reason}`;
    }
    if (remote && linkState === 'failed') return 'Opponent not responding';
    if (remote && game.turn() !== remote.myColor && !finishingMate && !losingSideCounter) return 'Opponent’s turn';
    if (losingSideCounter) return 'Checkmate — your king can strike back. Tap it, then a checking piece.';
    if (finishingMate) return 'Checkmate — capture the king to win';
    if (thinking) return 'Computer is thinking…';
    if (game.isStalemate()) return 'Stalemate';
    if (game.isDraw()) return 'Draw';
    if (game.inCheck()) return 'Check';
    return null;
  })();

  const activeSide: 'w' | 'b' | null = gameOver
    ? null
    : losingSideCounter
    ? losingSideCounter.matedColor
    : finishingMate
    ? finishingMate.winnerColor
    : phase === 'playing'
    ? game.turn()
    : null;

  const baseHintBlocked =
    phase !== 'playing' || !!gameOver || !!finishingMate || !!losingSideCounter || !!pendingPromotion || thinking;

  const bottomColor: 'w' | 'b' = remote ? remote.myColor : 'w';
  const topColor: 'w' | 'b' = bottomColor === 'w' ? 'b' : 'w';

  // One player's block: clock + their trophy row. The top block has the clock
  // first, the bottom block the trophies first (trophies always sit directly
  // below the board from the owner's own view in single-device mode).
  const renderPanel = (color: 'w' | 'b', top: boolean) => {
    const isW = color === 'w';
    const flipped = !remote && top; // single-device: the top player sits opposite
    const clock = (
      <ClockDisplay
        label={isW ? 'White' : 'Black'}
        seconds={isW ? whiteSeconds : blackSeconds}
        active={active === (isW ? 'white' : 'black')}
        flipped={flipped}
        paused={paused}
        onPauseToggle={handlePauseToggle}
        onHintToggle={() => handleHintToggle(color)}
        hintActive={hintEnabled[color]}
        hintDisabled={baseHintBlocked || (vsComputer && computerColor === color) || (!!remote && remote.myColor !== color)}
        hidePause={!!remote}
      />
    );
    const trophies = (
      <CapturedPieces
        color={isW ? 'b' : 'w'}
        pieces={isW ? capturedBlack : capturedWhite}
        advantage={isW ? whiteAdvantage : blackAdvantage}
        flipped={flipped}
      />
    );
    return (
      <div className={`player-panel ${activeSide === color ? 'active-panel' : ''}`}>
        {top ? clock : trophies}
        {top ? trophies : clock}
      </div>
    );
  };

  return (
    <div className="app">
      <div className="top-bar">
        {onBack && <button className="menu-back-btn" onClick={onBack}>← Menu</button>}
        <span className="turn-indicator">{status}</span>
        {!remote && phase === 'playing' && <button onClick={handleOpenSetup}>New game</button>}
        {remote && linkState === 'failed' && (
          <button
            onClick={() => {
              const f = failedSend.current;
              if (f) enqueueSend(f.type, f.payload);
            }}
          >
            Resend
          </button>
        )}
        {remote && !gameOver && (
          <>
            <button onClick={() => { enqueueSend('resign', []); setActive(null); setGameOver({ winner: remote.myColor === 'w' ? 'black' : 'white', reason: 'resignation' }); }}>
              Resign
            </button>
            <button
              disabled={drawPending}
              onClick={() => { setDrawPending(true); enqueueSend('drawOffer', []); }}
            >
              {drawPending ? 'Draw offered…' : 'Offer draw'}
            </button>
          </>
        )}
        {remote && linkState === 'sending' && <span className="link-banner">📡 sending…</span>}
      </div>

      {renderPanel(topColor, true)}

      <ChessBoard
        game={game}
        selected={selected}
        legalMoves={legalMoves}
        onSquareTap={handleSquareTap}
        hintFrom={hintMove?.from}
        hintTo={hintMove?.to}
        bloodMap={bloodMap}
        analysisLines={analysisLines}
        analysisTint={analysisTint}
        lastMove={lastMove}
        orientation={remote ? remote.myColor : 'w'}
        upright={!!remote}
      />

      {renderPanel(bottomColor, false)}

      {phase === 'setup' && (
        <div className="setup-overlay">
          <div className="setup-panel">
            <h2>New Game</h2>
            <div className="time-controls">
              {TIME_CONTROLS.map((tc) => (
                <button
                  key={tc}
                  className={setupMinutes === tc ? 'active-tc' : ''}
                  onClick={() => setSetupMinutes(tc)}
                >
                  {tc}m
                </button>
              ))}
            </div>

            <div className="time-controls">
              <button className={!setupVsComputer ? 'active-tc' : ''} onClick={() => setSetupVsComputer(false)}>
                Two Players
              </button>
              <button className={setupVsComputer ? 'active-tc' : ''} onClick={() => setSetupVsComputer(true)}>
                Vs Computer
              </button>
            </div>

            {setupVsComputer && (
              <>
                <div className="time-controls">
                  <button
                    className={setupComputerColor === 'w' ? 'active-tc' : ''}
                    onClick={() => setSetupComputerColor('w')}
                  >
                    Computer: White
                  </button>
                  <button
                    className={setupComputerColor === 'b' ? 'active-tc' : ''}
                    onClick={() => setSetupComputerColor('b')}
                  >
                    Computer: Black
                  </button>
                </div>
                <div className="time-controls">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      className={setupDifficulty === d ? 'active-tc' : ''}
                      onClick={() => setSetupDifficulty(d)}
                    >
                      {d[0].toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="setup-hint">
              Optional: tap pieces on the board to remove them as a handicap. This is only possible now, before the game starts.
            </p>
            <button className="start-game-btn" onClick={handleStartGame}>Start Game</button>
          </div>
        </div>
      )}

      {pendingPromotion && (
        <PromotionPicker color={pendingPromotion.color} onChoose={handlePromotionChoice} />
      )}

      {remote && drawOffered && !gameOver && (
        <div className="setup-overlay">
          <div className="setup-panel">
            <h2>Draw offered</h2>
            <div className="time-controls">
              <button
                onClick={() => {
                  setDrawOffered(false);
                  setActive(null);
                  setGameOver({ winner: null, reason: 'agreement' });
                  enqueueSend('drawAccept', []);
                }}
              >
                Accept
              </button>
              <button onClick={() => { setDrawOffered(false); enqueueSend('drawDecline', []); }}>Decline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
