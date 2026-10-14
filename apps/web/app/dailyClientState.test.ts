import { describe, expect, it } from 'vitest';
import {
  createInitialAtBatUiState,
  withConfirmedIncorrectGuess,
} from './dailyClientState';

describe('confirmed incorrect-guess history', () => {
  const incorrect = {
    kind: 'incorrect' as const,
    revealedCount: 0 as const,
    strikeCount: 1,
    remainingStrikes: 2,
  };
  const selection = { playerId: 'p1', displayName: 'Ken Griffey Jr.' };

  it('records only a confirmed incorrect response for points-v4 without changing strikes', () => {
    const state = createInitialAtBatUiState();
    expect(state).not.toHaveProperty('wrongGuesses');
    const next = withConfirmedIncorrectGuess(state, incorrect, selection, true);
    expect(next).toMatchObject({
      query: '', selectedPlayerId: null, strikeCount: 1,
      submittedResult: incorrect, wrongGuesses: [selection],
    });
    expect(state).not.toHaveProperty('wrongGuesses');
    expect(createInitialAtBatUiState()).not.toHaveProperty('wrongGuesses');
  });

  it('does not collect guesses for Classic', () => {
    const next = withConfirmedIncorrectGuess(
      createInitialAtBatUiState(), incorrect, selection, false,
    );
    expect(next).not.toHaveProperty('wrongGuesses');
  });

  it('keeps at most three names and clears them on a new at-bat', () => {
    let state = createInitialAtBatUiState();
    for (let index = 1; index <= 4; index++) {
      state = withConfirmedIncorrectGuess(
        state, { ...incorrect, strikeCount: index },
        { playerId: String(index), displayName: `Player ${index}` }, true,
      );
    }
    expect(state.wrongGuesses?.map(x => x.displayName))
      .toEqual(['Player 2', 'Player 3', 'Player 4']);
    expect(createInitialAtBatUiState().wrongGuesses).toBeUndefined();
  });
});
