const FEN_KEY = 'chess-app-fen';

export function saveFen(fen: string): void {
  try {
    localStorage.setItem(FEN_KEY, fen);
  } catch {
    // storage unavailable, ignore
  }
}

export function loadFen(): string | null {
  try {
    return localStorage.getItem(FEN_KEY);
  } catch {
    return null;
  }
}

export function clearFen(): void {
  try {
    localStorage.removeItem(FEN_KEY);
  } catch {
    // ignore
  }
}
