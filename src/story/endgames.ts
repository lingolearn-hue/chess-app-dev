export interface Endgame {
  id: string;
  name: string;
  category: 'beginner' | 'intermediate' | 'advanced';
  fen: string;
  objective: string;
  technique: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const ENDGAMES: Endgame[] = [
  {
    id: 'kq-vs-k',
    name: 'King + Queen vs King',
    category: 'beginner',
    fen: '8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1',
    objective: 'Checkmate the black king.',
    technique: 'Use the queen to confine the king to a shrinking box, then bring your own king up to help deliver mate.',
    difficulty: 'beginner',
  },
  {
    id: 'kr-vs-k',
    name: 'King + Rook vs King',
    category: 'beginner',
    fen: '8/8/8/4k3/8/8/4R3/4K3 w - - 0 1',
    objective: 'Checkmate the black king.',
    technique: 'Cut the king off with the rook on a rank or file, then walk your king up to force it to the edge.',
    difficulty: 'beginner',
  },
  {
    id: 'kp-vs-k',
    name: 'King + Pawn vs King',
    category: 'beginner',
    fen: '8/8/8/8/4k3/8/4P3/4K3 w - - 0 1',
    objective: 'Promote the pawn or win material to force checkmate.',
    technique: 'Keep your king ahead of or level with the pawn, and use opposition to escort it to the promotion square.',
    difficulty: 'beginner',
  },
  {
    id: 'opposition',
    name: 'Opposition',
    category: 'beginner',
    fen: '8/4k3/8/4K3/4P3/8/8/8 w - - 0 1',
    objective: 'Advance the pawn safely to promotion.',
    technique: 'Direct opposition (kings facing each other with one square between) forces the defending king to give way.',
    difficulty: 'beginner',
  },
  {
    id: 'pawn-promotion-race',
    name: 'Pawn Promotion',
    category: 'beginner',
    fen: '8/1k6/8/8/8/8/1KP5/8 w - - 0 1',
    objective: 'Escort the pawn safely to the eighth rank.',
    technique: 'Shield the pawn with your king and avoid stalemate tricks as the defending king closes in.',
    difficulty: 'beginner',
  },
];

export function getEndgame(id: string): Endgame | undefined {
  return ENDGAMES.find((e) => e.id === id);
}
