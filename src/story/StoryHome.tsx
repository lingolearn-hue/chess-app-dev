import PieceIcon from '../PieceIcon';
import { OPPONENTS } from './opponents';
import { isUnlocked, loadOpponentRecord, loadXp } from './storyStorage';

interface Props {
  onSelectOpponent: (id: string) => void;
  onBack: () => void;
}

export default function StoryHome({ onSelectOpponent, onBack }: Props) {
  const xp = loadXp();

  return (
    <div className="story-home-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="home-title">Story Mode</h1>
      <p className="xp-total">XP: {xp}</p>

      <div className="opponent-list">
        {OPPONENTS.map((opponent) => {
          const unlocked = isUnlocked(opponent);
          const record = loadOpponentRecord(opponent.id);
          return (
            <button
              key={opponent.id}
              className={`opponent-row ${unlocked ? '' : 'locked'}`}
              onClick={() => unlocked && onSelectOpponent(opponent.id)}
              disabled={!unlocked}
            >
              <span className="opponent-row-portrait" style={{ background: opponent.color }}>
                {unlocked ? <PieceIcon type={opponent.pieceTheme} color="w" /> : <span className="lock-icon">🔒</span>}
              </span>
              <span className="opponent-row-info">
                <span className="opponent-row-name">{opponent.name}</span>
                <span className="opponent-row-meta">
                  Stage {opponent.stage} · Rating {opponent.rating}
                  {unlocked && (record.wins + record.losses + record.draws) > 0
                    ? ` · ${record.wins}–${record.losses}–${record.draws}`
                    : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
