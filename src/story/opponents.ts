export interface Opponent {
  id: string;
  name: string;
  stage: number;
  pieceTheme: 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
  rating: number;
  difficulty: 'easy' | 'medium' | 'hard';
  // Search depth + blunder chance. Depth alone (3 tiers) can't distinguish
  // eight opponents, so early opponents blunder more often as well — this is
  // what makes them actually play at noticeably different strengths.
  engineStrength: { depth: number; blunderChance: number };
  color: string;
  preGameLines: string[];
  winLines: string[]; // opponent's line when the opponent wins
  loseLines: string[]; // opponent's line when the opponent loses
  drawLines: string[];
  // Defeat this opponent (at least one win) to unlock the next one. The
  // first opponent has no requirement.
  requiresOpponentId?: string;
}

export const OPPONENTS: Opponent[] = [
  {
    id: 'king_leo',
    name: 'Leo the King',
    stage: 1,
    pieceTheme: 'k',
    rating: 500,
    difficulty: 'easy',
    engineStrength: { depth: 1, blunderChance: 0.35 },
    color: '#4a6fa5',
    preGameLines: [
      "I may be slow, but I've never given up my throne without a fight.",
      "Let's see what you've got, challenger.",
    ],
    winLines: ['Royalty prevails! Come back when you\u2019re ready for a rematch.', 'The crown stays with me — for now.'],
    loseLines: ['Impressive! You\u2019ve earned your first victory.', 'You outplayed me fair and square. Well played.'],
    drawLines: ['A fair result — neither of us gave an inch.'],
  },
  {
    id: 'pawn_penny',
    name: 'Penny the Pawn',
    stage: 2,
    pieceTheme: 'p',
    rating: 700,
    difficulty: 'easy',
    engineStrength: { depth: 1, blunderChance: 0.18 },
    color: '#5a8f5a',
    preGameLines: ['One square at a time — that\u2019s how I get ahead.', 'Small steps win big games.'],
    winLines: ['Slow and steady! Better luck next time.', 'Patience pays off.'],
    loseLines: ['You broke through my structure. Nicely done!', 'A well-earned win.'],
    drawLines: ['Neither of us budged an inch.'],
    requiresOpponentId: 'king_leo',
  },
  {
    id: 'knight_nico',
    name: 'Nico the Knight',
    stage: 3,
    pieceTheme: 'n',
    rating: 900,
    difficulty: 'medium',
    engineStrength: { depth: 2, blunderChance: 0.12 },
    color: '#8a5a3a',
    preGameLines: ['Ready for some tricky jumps?', 'I like it complicated.'],
    winLines: ['Forked you! Try again sometime.', 'Knights see angles others miss.'],
    loseLines: ['You saw through my tactics — well played!', 'Sharp game. You earned that.'],
    drawLines: ['A tangled, even fight.'],
    requiresOpponentId: 'pawn_penny',
  },
  {
    id: 'bishop_bea',
    name: 'Bea the Bishop',
    stage: 4,
    pieceTheme: 'b',
    rating: 1100,
    difficulty: 'medium',
    engineStrength: { depth: 2, blunderChance: 0.06 },
    color: '#6a4a8a',
    preGameLines: ['I do like a good open diagonal.', 'Let\u2019s keep this elegant.'],
    winLines: ['Straight down the diagonal! Good effort.', 'Precision wins the day.'],
    loseLines: ['A beautifully played game — you\u2019ve got my respect.', 'Well played indeed.'],
    drawLines: ['Balanced to the very end.'],
    requiresOpponentId: 'knight_nico',
  },
  {
    id: 'rook_rex',
    name: 'Rex the Rook',
    stage: 5,
    pieceTheme: 'r',
    rating: 1300,
    difficulty: 'medium',
    engineStrength: { depth: 2, blunderChance: 0.0 },
    color: '#a05a5a',
    preGameLines: ['Open files are my domain.', 'Straightforward and strong — that\u2019s my style.'],
    winLines: ['Ruled that file! Try again.', 'Simplicity wins.'],
    loseLines: ['You controlled the position better than I did.', 'A clean, deserved win.'],
    drawLines: ['A solid, even battle.'],
    requiresOpponentId: 'bishop_bea',
  },
  {
    id: 'queen_quinn',
    name: 'Quinn the Queen',
    stage: 6,
    pieceTheme: 'q',
    rating: 1500,
    difficulty: 'hard',
    engineStrength: { depth: 3, blunderChance: 0.0 },
    color: '#a05a9a',
    preGameLines: ['I don\u2019t lose often.', 'Show me what you\u2019ve learned.'],
    winLines: ['Royalty has its privileges. Well fought, though.', 'A worthy attempt.'],
    loseLines: ['You\u2019ve truly earned this one — congratulations!', 'A masterful game.'],
    drawLines: ['Evenly matched — impressive.'],
    requiresOpponentId: 'rook_rex',
  },
  {
    id: 'advanced_ada',
    name: 'Ada, Advanced Tactician',
    stage: 7,
    pieceTheme: 'q',
    rating: 1700,
    difficulty: 'hard',
    engineStrength: { depth: 3, blunderChance: 0.0 },
    color: '#3a3a6a',
    preGameLines: ['Let\u2019s see if you\u2019ve mastered the fundamentals.', 'This will be a real test.'],
    winLines: ['A good effort — refine your technique and try again.', 'You\u2019re close. Keep at it.'],
    loseLines: ['Outstanding play — you\u2019ve earned this win.', 'Truly excellent chess.'],
    drawLines: ['A hard-fought draw.'],
    requiresOpponentId: 'queen_quinn',
  },
  {
    id: 'grandmaster_zed',
    name: 'Zed the Grandmaster',
    stage: 8,
    pieceTheme: 'k',
    rating: 1900,
    difficulty: 'hard',
    engineStrength: { depth: 3, blunderChance: 0.0 },
    color: '#1a1a1a',
    preGameLines: ['Few make it this far.', 'Let\u2019s find out what you\u2019re truly made of.'],
    winLines: ['A respectable challenge. Return when you\u2019re ready.', 'Not bad — but not enough.'],
    loseLines: ['You have bested a Grandmaster. Remarkable.', 'A historic win — well done.'],
    drawLines: ['A draw against a Grandmaster is no small feat.'],
    requiresOpponentId: 'advanced_ada',
  },
];

export function getOpponent(id: string): Opponent | undefined {
  return OPPONENTS.find((o) => o.id === id);
}
