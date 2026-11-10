/**
 * Small, browser-safe official Daily identity contract.
 * Keep this module independent of clue snapshots, selection and generated player data.
 */

/** UUIDv4 occurrence allocated once by the private publisher. */
export function isOfficialDailyOccurrenceId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

/** Strict real calendar day for issued Daily puzzle identity. */
export function validateIssuedDailyCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Issued Daily puzzle date must use YYYY-MM-DD.');
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Issued Daily puzzle date is not a valid calendar date.');
  }
}
