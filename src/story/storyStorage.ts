import type { Opponent } from './opponents';

interface Record {
  wins: number;
  losses: number;
  draws: number;
}

const PLAYER_RATING_KEY = 'story-player-rating';
const XP_KEY = 'story-xp';
const DEFAULT_RATING = 1000;

export function loadXp(): number {
  try {
    const v = localStorage.getItem(XP_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

export function addXp(amount: number): number {
  const next = loadXp() + amount;
  try {
    localStorage.setItem(XP_KEY, String(next));
  } catch {
    // storage unavailable, ignore
  }
  return next;
}

export function loadPlayerRating(): number {
  try {
    const v = localStorage.getItem(PLAYER_RATING_KEY);
    return v ? parseInt(v, 10) : DEFAULT_RATING;
  } catch {
    return DEFAULT_RATING;
  }
}

export function savePlayerRating(rating: number): void {
  try {
    localStorage.setItem(PLAYER_RATING_KEY, String(rating));
  } catch {
    // storage unavailable, ignore
  }
}

export function loadOpponentRecord(opponentId: string): Record {
  try {
    const v = localStorage.getItem(`story-record-${opponentId}`);
    return v ? JSON.parse(v) : { wins: 0, losses: 0, draws: 0 };
  } catch {
    return { wins: 0, losses: 0, draws: 0 };
  }
}

export function saveOpponentRecord(opponentId: string, record: Record): void {
  try {
    localStorage.setItem(`story-record-${opponentId}`, JSON.stringify(record));
  } catch {
    // storage unavailable, ignore
  }
}

export function isUnlocked(opponent: Opponent): boolean {
  if (!opponent.requiresOpponentId) return true;
  return loadOpponentRecord(opponent.requiresOpponentId).wins > 0;
}
