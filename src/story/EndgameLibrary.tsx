import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../ChessBoard';
import { ENDGAMES, type Endgame } from './endgames';

interface Props {
  onPractice: (fen: string, title: string, objective: string) => void;
  onBack: () => void;
}

function EndgameDetail({ endgame, onPractice, onBack }: { endgame: Endgame; onPractice: Props['onPractice']; onBack: () => void }) {
  const game = useMemo(() => new Chess(endgame.fen), [endgame]);

  return (
    <div className="lesson-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>{endgame.name}</h2>
      <p className="lesson-text">{endgame.category} · {endgame.difficulty}</p>
      <p className="lesson-text">Objective: {endgame.objective}</p>
      <p className="lesson-text">Technique: {endgame.technique}</p>

      <ChessBoard game={game} selected={null} legalMoves={[]} onSquareTap={() => {}} />

      <button className="play-btn" onClick={() => onPractice(endgame.fen, endgame.name, endgame.objective)}>
        Practice this position
      </button>
    </div>
  );
}

export default function EndgameLibrary({ onPractice, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = ENDGAMES.find((e) => e.id === selectedId);

  if (selected) {
    return <EndgameDetail endgame={selected} onPractice={onPractice} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="story-home-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="home-title">Endgame Library</h1>
      <div className="opponent-list">
        {ENDGAMES.map((endgame) => (
          <button key={endgame.id} className="opponent-row" onClick={() => setSelectedId(endgame.id)}>
            <span className="opponent-row-info">
              <span className="opponent-row-name">{endgame.name}</span>
              <span className="opponent-row-meta">{endgame.category} · {endgame.difficulty}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
