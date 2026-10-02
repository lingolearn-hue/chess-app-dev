import PieceIcon from '../PieceIcon';
import type { Opponent } from './opponents';

type Expression = 'neutral' | 'capturedPiece' | 'lostPiece' | 'won' | 'lost';

interface Props {
  opponent: Opponent;
  expression?: Expression;
  size?: 'small' | 'normal';
}

export default function Portrait({ opponent, expression = 'neutral', size = 'normal' }: Props) {
  const src = opponent.portraits?.[expression] ?? opponent.portraits?.neutral;
  const sizeClass = size === 'small' ? 'small' : '';

  if (src) {
    return (
      <div className={`opponent-portrait ${sizeClass}`} style={{ background: opponent.color, padding: 0 }}>
        <img src={src} alt={opponent.name} className="opponent-portrait-img" />
      </div>
    );
  }

  return (
    <div className={`opponent-portrait ${sizeClass}`} style={{ background: opponent.color }}>
      <PieceIcon type={opponent.pieceTheme} color="w" />
    </div>
  );
}
