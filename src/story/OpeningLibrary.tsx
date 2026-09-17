import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../ChessBoard';
import { OPENINGS, type Opening } from './openings';

interface Props {
  onPractice: (fen: string, title: string) => void;
  onBack: () => void;
}

function OpeningDetail({ opening, onPractice, onBack }: { opening: Opening; onPractice: (fen: string, title: string) => void; onBack: () => void }) {
  const game = useMemo(() => {
    const g = new Chess();
    for (const san of opening.mainLineSan) {
      try {
        g.move(san);
      } catch {
        break;
      }
    }
    return g;
  }, [opening]);

  return (
    <div className="lesson-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>{opening.name}</h2>
      <p className="lesson-text">
        {opening.ecoCode} · {opening.category} · {opening.difficulty}
      </p>
      <p className="lesson-text">{opening.description}</p>
      <p className="lesson-text">Main line: {opening.mainLineSan.join(' ')}</p>

      <ChessBoard game={game} selected={null} legalMoves={[]} onSquareTap={() => {}} />

      <button className="play-btn" onClick={() => onPractice(game.fen(), opening.name)}>
        Practice from here
      </button>
    </div>
  );
}

export default function OpeningLibrary({ onPractice, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = OPENINGS.find((o) => o.id === selectedId);

  if (selected) {
    return <OpeningDetail opening={selected} onPractice={onPractice} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="story-home-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="home-title">Opening Library</h1>
      <div className="opponent-list">
        {OPENINGS.map((opening) => (
          <button key={opening.id} className="opponent-row" onClick={() => setSelectedId(opening.id)}>
            <span className="opponent-row-info">
              <span className="opponent-row-name">{opening.name}</span>
              <span className="opponent-row-meta">{opening.ecoCode} · {opening.category} · {opening.difficulty}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
