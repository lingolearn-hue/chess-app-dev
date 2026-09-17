export interface LessonStep {
  instruction: string;
  expectedFrom: string;
  expectedTo: string;
  // Auto-played by the opponent immediately after the player's correct move.
  opponentReplyFrom?: string;
  opponentReplyTo?: string;
}

export interface Lesson {
  id: string;
  title: string;
  intro: string;
  steps: LessonStep[];
  outro: string;
}

export const ITALIAN_GAME_LESSON: Lesson = {
  id: 'italian-game',
  title: 'The Italian Game',
  intro: 'One of the oldest and most natural openings in chess. Play the White pieces and follow along.',
  steps: [
    {
      instruction: 'Start by controlling the center — play e4.',
      expectedFrom: 'e2',
      expectedTo: 'e4',
      opponentReplyFrom: 'e7',
      opponentReplyTo: 'e5',
    },
    {
      instruction: 'Develop your knight toward the center.',
      expectedFrom: 'g1',
      expectedTo: 'f3',
      opponentReplyFrom: 'b8',
      opponentReplyTo: 'c6',
    },
    {
      instruction: 'Aim your bishop at the weak f7 square — this is the Italian Game.',
      expectedFrom: 'f1',
      expectedTo: 'c4',
    },
  ],
  outro: 'That\u2019s the Italian Game! Your bishop and knight are developed and aimed at the center — a strong, natural setup.',
};

export const LONDON_SYSTEM_LESSON: Lesson = {
  id: 'london-system',
  title: 'The London System',
  intro: 'A simple, solid setup you can play against almost anything. Play the White pieces.',
  steps: [
    {
      instruction: 'Claim the center with your queen\u2019s pawn.',
      expectedFrom: 'd2',
      expectedTo: 'd4',
      opponentReplyFrom: 'd7',
      opponentReplyTo: 'd5',
    },
    {
      instruction: 'Develop your knight to a natural square.',
      expectedFrom: 'g1',
      expectedTo: 'f3',
      opponentReplyFrom: 'g8',
      opponentReplyTo: 'f6',
    },
    {
      instruction: 'Bring your bishop out before playing e3 — this is the London System.',
      expectedFrom: 'c1',
      expectedTo: 'f4',
    },
  ],
  outro: 'That\u2019s the London System! Your bishop got out before your pawns boxed it in — a reliable setup for any opening you face.',
};

export const LESSONS: Record<string, Lesson> = {
  king_leo: ITALIAN_GAME_LESSON,
  pawn_penny: LONDON_SYSTEM_LESSON,
};

export interface Puzzle {
  id: string;
  title: string;
  instruction: string;
  fen: string;
  solutionFrom: string;
  solutionTo: string;
  successText: string;
}

export const SCHOLARS_MATE_PUZZLE: Puzzle = {
  id: 'scholars-mate-finish',
  title: 'Find the Finish',
  instruction: 'White to move. Black just blundered — find the checkmate in one.',
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  solutionFrom: 'h5',
  solutionTo: 'f7',
  successText: 'Qxf7# — checkmate! The queen and bishop combine to attack f7 with no defender.',
};

export const BACK_RANK_MATE_PUZZLE: Puzzle = {
  id: 'back-rank-mate',
  title: 'Back Rank Weakness',
  instruction: 'White to move. Black\u2019s own pawns are blocking the king\u2019s escape — find the mate in one.',
  fen: '6k1/5ppp/8/8/8/8/8/3R3K w - - 0 1',
  solutionFrom: 'd1',
  solutionTo: 'd8',
  successText: 'Rd8# — the classic back-rank mate. The king had nowhere to run.',
};

export const PUZZLES: Record<string, Puzzle> = {
  king_leo: SCHOLARS_MATE_PUZZLE,
  pawn_penny: BACK_RANK_MATE_PUZZLE,
};
