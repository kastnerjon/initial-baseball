/** Browser-local terminal reveals. Never pass this record into public share output. */
export type DailyScorecardAnswers = Record<number, string>;

export function restoreDailyScorecardAnswers(
  value: unknown,
  resolvedPitchNumbers: number[],
): DailyScorecardAnswers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const answers: DailyScorecardAnswers = {};
  for (const pitchNumber of resolvedPitchNumbers) {
    const name = record[pitchNumber];
    if (typeof name === 'string' && name.trim().length > 0 && name.length <= 200) {
      answers[pitchNumber] = name;
    }
  }
  return answers;
}
