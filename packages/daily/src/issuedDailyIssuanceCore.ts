import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';
import type { DailyPuzzleEditorialRecord } from './dailyPuzzleLifecycle';

export type IssuedDailyIssuanceEditorialPuzzle = Pick<
  DailyPuzzleEditorialRecord,
  'puzzleDate' | 'status' | 'selections'
>;

export function resolveIssuedDailyIssuanceLineup(
  identity: { puzzleDate: string },
  puzzle: IssuedDailyIssuanceEditorialPuzzle,
  seriesLabel: string,
): readonly string[] {
  if (puzzle.puzzleDate !== identity.puzzleDate) {
    throw new Error(
      `${seriesLabel} identity date ${identity.puzzleDate} does not match editorial puzzle ${puzzle.puzzleDate}.`,
    );
  }

  if (puzzle.status !== 'scheduled' && puzzle.status !== 'published') {
    throw new Error(
      `${seriesLabel} issuance requires a scheduled or published editorial puzzle; received ${puzzle.status}.`,
    );
  }

  if (puzzle.selections.length !== DAILY_AT_BAT_COUNT) {
    throw new Error(
      `${seriesLabel} issuance requires exactly ${DAILY_AT_BAT_COUNT} editorial selections.`,
    );
  }

  const ordered = [...puzzle.selections].sort((left, right) => left.slot - right.slot);
  ordered.forEach((selection, index) => {
    const expectedSlot = index + 1;
    if (selection.slot !== expectedSlot) {
      throw new Error(
        `${seriesLabel} issuance requires exact editorial slots 1 through ${DAILY_AT_BAT_COUNT}; expected slot ${expectedSlot} but received ${selection.slot}.`,
      );
    }
  });

  return ordered.map(selection => selection.canonicalPlayerId);
}
