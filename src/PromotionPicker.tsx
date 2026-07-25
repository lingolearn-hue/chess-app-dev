import PieceIcon from './PieceIcon';

const CHOICES: Array<'q' | 'r' | 'b' | 'n'> = ['q', 'r', 'b', 'n'];

interface Props {
  color: 'w' | 'b';
  onChoose: (piece: 'q' | 'r' | 'b' | 'n') => void;
}

export default function PromotionPicker({ color, onChoose }: Props) {
  return (
    <div className="promotion-overlay">
      <div className="promotion-panel">
        {CHOICES.map((p) => (
          <button key={p} className="promotion-choice" onClick={() => onChoose(p)}>
            <PieceIcon type={p} color={color} />
          </button>
        ))}
      </div>
    </div>
  );
}
