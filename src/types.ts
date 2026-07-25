export type Square = string; // e.g. "e4"

export interface SelectedState {
  square: Square | null;
  legalMoves: Square[];
}
