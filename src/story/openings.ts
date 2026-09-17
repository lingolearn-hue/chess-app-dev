export interface Opening {
  id: string;
  name: string;
  ecoCode: string;
  category: string;
  mainLineSan: string[]; // moves from the starting position
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
}

export const OPENINGS: Opening[] = [
  {
    id: 'italian-game',
    name: 'Italian Game',
    ecoCode: 'C50',
    category: "King's Pawn Opening",
    mainLineSan: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    difficulty: 'beginner',
    description: 'One of the oldest recorded openings. White develops naturally and aims the bishop at f7.',
  },
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    ecoCode: 'C60',
    category: "King's Pawn Opening",
    mainLineSan: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    difficulty: 'intermediate',
    description: 'A classical opening that pressures the knight defending Black\u2019s e5 pawn.',
  },
  {
    id: 'sicilian-defense',
    name: 'Sicilian Defense',
    ecoCode: 'B20',
    category: 'Semi-Open Game',
    mainLineSan: ['e4', 'c5'],
    difficulty: 'intermediate',
    description: 'Black fights for the center asymmetrically, leading to sharp, unbalanced positions.',
  },
  {
    id: 'french-defense',
    name: 'French Defense',
    ecoCode: 'C00',
    category: "King's Pawn Opening",
    mainLineSan: ['e4', 'e6'],
    difficulty: 'beginner',
    description: 'A solid, resilient defense that often leads to a locked pawn structure.',
  },
  {
    id: 'caro-kann-defense',
    name: 'Caro-Kann Defense',
    ecoCode: 'B10',
    category: "King's Pawn Opening",
    mainLineSan: ['e4', 'c6'],
    difficulty: 'beginner',
    description: 'Solid and low-risk, preparing ...d5 without blocking the light-squared bishop.',
  },
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    ecoCode: 'D06',
    category: "Queen's Pawn Opening",
    mainLineSan: ['d4', 'd5', 'c4'],
    difficulty: 'intermediate',
    description: 'White offers a pawn to gain central control and open lines for development.',
  },
  {
    id: 'london-system',
    name: 'London System',
    ecoCode: 'D02',
    category: "Queen's Pawn Opening",
    mainLineSan: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],
    difficulty: 'beginner',
    description: 'A simple, reliable setup that can be played against almost any Black reply.',
  },
  {
    id: 'kings-indian-defense',
    name: "King's Indian Defense",
    ecoCode: 'E60',
    category: 'Indian Defense',
    mainLineSan: ['d4', 'Nf6', 'c4', 'g6'],
    difficulty: 'advanced',
    description: 'Black allows White a big center, planning to strike back with ...e5 or ...c5 later.',
  },
  {
    id: 'english-opening',
    name: 'English Opening',
    ecoCode: 'A10',
    category: 'Flank Opening',
    mainLineSan: ['c4'],
    difficulty: 'intermediate',
    description: 'A flexible flank opening that can transpose into many other systems.',
  },
];

export function getOpening(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id);
}
