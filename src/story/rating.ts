export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// actualScore: 1 = win, 0.5 = draw, 0 = loss
export function updateRating(rating: number, expected: number, actualScore: number, kFactor = 32): number {
  return Math.round(rating + kFactor * (actualScore - expected));
}
