import PieceIcon from '../PieceIcon';
import type { Opponent } from './opponents';
import { LESSONS, PUZZLES } from './content';

interface Props {
  opponent: Opponent;
  playerRating: number;
  record: { wins: number; losses: number; draws: number };
  onLesson: () => void;
  onPuzzle: () => void;
  onPlay: () => void;
  onBack: () => void;
}

export default function OpponentScreen({ opponent, playerRating, record, onLesson, onPuzzle, onPlay, onBack }: Props) {
  const hasLesson = !!LESSONS[opponent.id];
  const hasPuzzle = !!PUZZLES[opponent.id];

  return (
    <div className="opponent-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className="opponent-portrait" style={{ background: opponent.color }}>
        <PieceIcon type={opponent.pieceTheme} color="w" />
      </div>

      <h2 className="opponent-name">{opponent.name}</h2>
      <p className="opponent-meta">Rating: {opponent.rating}</p>
      <p className="opponent-meta">Your rating: {playerRating}</p>
      <p className="opponent-meta">Record: {record.wins}–{record.losses}–{record.draws}</p>

      <div className="opponent-actions">
        <button onClick={onLesson} disabled={!hasLesson} title={hasLesson ? '' : 'Coming soon'}>
          Lesson{hasLesson ? '' : ' (soon)'}
        </button>
        <button onClick={onPuzzle} disabled={!hasPuzzle} title={hasPuzzle ? '' : 'Coming soon'}>
          Puzzle{hasPuzzle ? '' : ' (soon)'}
        </button>
        <button className="play-btn" onClick={onPlay}>Play Game</button>
      </div>
    </div>
  );
}
