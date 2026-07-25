interface Props {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  className?: string;
}

const FILL = { w: '#fbfbfb', b: '#161616' };
const STROKE = { w: '#161616', b: '#fbfbfb' };

// All pieces share viewBox 0 0 45 45, consistent stroke width, same base silhouette
// language (rounded base, simple geometric head shapes) so no single piece looks
// like it belongs to a different set.
export default function PieceIcon({ type, color, className }: Props) {
  const fill = FILL[color];
  const stroke = STROKE[color];
  const common = {
    fill,
    stroke,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };

  const base = (
    <path d="M 9 39 L 36 39 L 34 34 L 11 34 Z" {...common} />
  );
  const baseLine = <line x1="9" y1="39" x2="36" y2="39" stroke={stroke} strokeWidth={1.5} />;

  let head: React.ReactNode;
  switch (type) {
    case 'p':
      head = (
        <>
          <circle cx="22.5" cy="14" r="6" {...common} />
          <path d="M 16 34 C 16 24 14 22 14 22 C 12 20 12 17 15 15 L 30 15 C 33 17 33 20 31 22 C 31 22 29 24 29 34 Z" {...common} />
        </>
      );
      break;
    case 'r':
      head = (
        <>
          <rect x="12" y="10" width="21" height="7" {...common} />
          <rect x="12" y="10" width="4" height="4" fill={fill} stroke={stroke} strokeWidth={1.2} />
          <rect x="20.5" y="10" width="4" height="4" fill={fill} stroke={stroke} strokeWidth={1.2} />
          <rect x="29" y="10" width="4" height="4" fill={fill} stroke={stroke} strokeWidth={1.2} />
          <path d="M 14 17 L 31 17 L 29 34 L 16 34 Z" {...common} />
        </>
      );
      break;
    case 'n':
      head = (
        <path
          d="M 24 34 C 24 34 22 28 17 26 C 13 24 12 20 14 17 C 15 15 17 15 18 13 C 18 11 16 11 16 9 C 16 7 18 6 20 7 C 24 9 22 12 25 13 C 29 15 32 19 32 24 C 32 28 30 34 30 34 Z"
          {...common}
        />
      );
      break;
    case 'b':
      head = (
        <>
          <circle cx="22.5" cy="10" r="3" {...common} />
          <path d="M 15 30 C 15 22 22.5 20 22.5 13 C 22.5 20 30 22 30 30 C 30 32 27 34 22.5 34 C 18 34 15 32 15 30 Z" {...common} />
          <line x1="18" y1="24" x2="27" y2="24" stroke={stroke} strokeWidth={1.2} />
        </>
      );
      break;
    case 'q':
      head = (
        <>
          <circle cx="12" cy="10" r="2.3" {...common} />
          <circle cx="19" cy="7" r="2.3" {...common} />
          <circle cx="26" cy="7" r="2.3" {...common} />
          <circle cx="33" cy="10" r="2.3" {...common} />
          <path d="M 12 12 L 33 12 L 30 26 C 30 26 26 24 22.5 24 C 19 24 15 26 15 26 Z" {...common} />
          <path d="M 15 26 C 15 26 13 30 14 34 L 31 34 C 32 30 30 26 30 26 Z" {...common} />
        </>
      );
      break;
    case 'k':
    default:
      head = (
        <>
          <line x1="22.5" y1="6" x2="22.5" y2="12" stroke={stroke} strokeWidth={1.8} />
          <line x1="19" y1="9" x2="26" y2="9" stroke={stroke} strokeWidth={1.8} />
          <path d="M 15 32 C 15 24 15 20 22.5 20 C 30 20 30 24 30 32 C 30 32 30 34 22.5 34 C 15 34 15 32 15 32 Z" {...common} />
          <path d="M 15 20 C 15 16 18 13 22.5 13 C 27 13 30 16 30 20" {...common} fill="none" />
        </>
      );
      break;
  }

  return (
    <svg
      viewBox="0 0 45 45"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {head}
      {base}
      {baseLine}
    </svg>
  );
}
