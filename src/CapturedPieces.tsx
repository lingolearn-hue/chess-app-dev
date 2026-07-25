import PieceIcon from './PieceIcon';

interface Props {
  color: 'w' | 'b'; // color of the captured pieces themselves
  pieces: string[]; // piece type letters, in the order they were captured
  advantage: number; // signed material advantage from this row's owner's perspective
  flipped?: boolean; // rotate the row so capture order reads left-to-right from that player's seated view
}

export default function CapturedPieces({ color, pieces, advantage, flipped }: Props) {
  return (
    <div className={`captured-row ${flipped ? 'flipped' : ''}`}>
      <span className={`advantage ${advantage < 0 ? 'negative' : ''}`}>
        {advantage !== 0 ? (advantage > 0 ? `+${advantage}` : advantage) : ''}
      </span>
      <span className="captured-pieces-list">
        {pieces.map((type, i) => (
          <span key={i} className="captured-piece">
            <PieceIcon type={type as any} color={color} />
          </span>
        ))}
      </span>
    </div>
  );
}
