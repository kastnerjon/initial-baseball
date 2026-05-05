const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

export function getPacificDailyDateString(date: Date = new Date()): string {
  return getDailyDateStringForTimeZone(date, PACIFIC_TIME_ZONE);
}

export function getDailyDateStringForTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = getDatePart(parts, 'year');
  const month = getDatePart(parts, 'month');
  const day = getDatePart(parts, 'day');

  return `${year}-${month}-${day}`;
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type);

  if (part === undefined) {
    throw new Error(`Unable to format Daily date part: ${type}.`);
  }

  return part.value;
}
