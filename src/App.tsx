import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import { ClockDisplay, useClockTicker } from './Clock';
import CapturedPieces from './CapturedPieces';
import PromotionPicker from './PromotionPicker';
import { saveFen, loadFen, clearFen } from './storage';
import './App.css';

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const TIME_CONTROLS = [5, 10, 15] as const;
const DEFAULT_MINUTES = 10;

function createGame(): Chess {
  const saved = loadFen();
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

type Phase = 'setup' | 'playing';

export default function App() {
  // A single mutable Chess instance lives for the whole game so its internal
  // move history (needed for the captured-pieces list) is never lost.
  // Re-creating a Chess object from FEN on every move drops that history,
  // since FEN encodes only the current position, not how it was reached.
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = createGame();
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const game = gameRef.current;

  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [finishingMate, setFinishingMate] = useState<FinishingMate | null>(null);

  // New games start in 'setup' phase: time control + optional handicap
  // (removing your own pieces) can only be adjusted here, before play begins.
  const [phase, setPhase] = useState<Phase>('playing');
  const [setupMinutes, setSetupMinutes] = useState<number>(DEFAULT_MINUTES);

  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);
  const [whiteSeconds, setWhiteSeconds] = useState(DEFAULT_MINUTES * 60);
  const [blackSeconds, setBlackSeconds] = useState(DEFAULT_MINUTES * 60);
  const [active, setActive] = useState<'white' | 'black' | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
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

  const finalizeMove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    try {
      gameRef.current!.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return;
    }
    setSelected(null);
    setLegalMoves([]);

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
        setFinishingMate({ winnerColor, kingSquare, attackerSquares });
        // Clock keeps the winner's side active; it's still their move.
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
    try {
      scratch.move({ from, to });
    } catch {
      return;
    }
    gameRef.current = scratch;
    setActive(null);
    setSelected(null);
    setLegalMoves([]);
    setGameOver({
      winner: finishingMate.winnerColor === 'w' ? 'white' : 'black',
      reason: 'checkmate',
    });
    setFinishingMate(null);
    bump();
  }, [finishingMate]);

  const handleRemovePiece = useCallback((square: string) => {
    const piece = gameRef.current!.get(square as any);
    if (!piece || piece.type === 'k') return; // kings can't be handicap-removed
    gameRef.current!.remove(square as any);
    bump();
  }, []);

  const handleSquareTap = useCallback((square: string) => {
    if (phase === 'setup') {
      handleRemovePiece(square);
      return;
    }

    if (finishingMate) {
      if (selected && square === finishingMate.kingSquare) {
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

    if (gameOver || pendingPromotion) return;

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
  }, [game, selected, legalMoves, pendingPromotion, finalizeMove, phase, handleRemovePiece, gameOver, finishingMate, finalizeKingCapture]);

  const handlePromotionChoice = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    finalizeMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  }, [pendingPromotion, finalizeMove]);

  const handleOpenSetup = () => {
    clearFen();
    gameRef.current = new Chess();
    setSelected(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    setGameOver(null);
    setFinishingMate(null);
    setSetupMinutes(minutes);
    setActive(null);
    setPaused(false);
    setPhase('setup');
    bump();
  };

  const handleStartGame = () => {
    setMinutes(setupMinutes);
    setWhiteSeconds(setupMinutes * 60);
    setBlackSeconds(setupMinutes * 60);
    setActive(null);
    setPhase('playing');
  };

  const handlePauseToggle = () => setPaused((p) => !p);

  // Derive captured pieces (in the order captured) + material advantage from move history.
  const history = game.history({ verbose: true }) as any[];
  const capturedBlack: string[] = []; // black pieces captured, i.e. White's trophies
  const capturedWhite: string[] = []; // white pieces captured, i.e. Black's trophies
  for (const m of history) {
    if (!m.captured) continue;
    if (m.color === 'w') capturedBlack.push(m.captured);
    else capturedWhite.push(m.captured);
  }
  const whiteAdvantage =
    capturedBlack.reduce((sum, t) => sum + (PIECE_VALUE[t] ?? 0), 0) -
    capturedWhite.reduce((sum, t) => sum + (PIECE_VALUE[t] ?? 0), 0);
  const blackAdvantage = -whiteAdvantage;

  const status = (() => {
    if (phase === 'setup') return 'Setting up new game';
    if (gameOver) return `${gameOver.winner === 'white' ? 'White' : 'Black'} wins by checkmate`;
    if (finishingMate) return 'Checkmate — capture the king to win';
    if (game.isStalemate()) return 'Stalemate';
    if (game.isDraw()) return 'Draw';
    if (game.inCheck()) return 'Check';
    return null;
  })();

  return (
    <div className="app">
      <div className="top-bar">
        <span className="turn-indicator">
          {status ? status : `${game.turn() === 'w' ? 'White' : 'Black'} to move`}
        </span>
        {phase === 'playing' && <button onClick={handleOpenSetup}>New game</button>}
      </div>

      {/* Black's own trophies (captured white pieces) sit below the board from Black's rotated view, i.e. at the top of the screen. */}
      <ClockDisplay
        label="Black"
        seconds={blackSeconds}
        active={active === 'black'}
        flipped
        paused={paused}
        onPauseToggle={handlePauseToggle}
      />
      <CapturedPieces color="w" pieces={capturedWhite} advantage={blackAdvantage} flipped />

      <ChessBoard
        game={game}
        selected={selected}
        legalMoves={legalMoves}
        onSquareTap={handleSquareTap}
      />

      {/* White's own trophies (captured black pieces) sit below the board from White's view, i.e. at the bottom of the screen. */}
      <CapturedPieces color="b" pieces={capturedBlack} advantage={whiteAdvantage} />
      <ClockDisplay
        label="White"
        seconds={whiteSeconds}
        active={active === 'white'}
        paused={paused}
        onPauseToggle={handlePauseToggle}
      />

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
    </div>
  );
}
