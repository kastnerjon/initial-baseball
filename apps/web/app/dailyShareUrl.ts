const DAILY_SHARE_PATH = '/';

export function createDailyShareUrl(): string {
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  if (configuredOrigin !== null) {
    return `${configuredOrigin}${DAILY_SHARE_PATH}`;
  }

  const browserOrigin = getBrowserOrigin();

  if (browserOrigin !== null) {
    return `${browserOrigin}${DAILY_SHARE_PATH}`;
  }

  return DAILY_SHARE_PATH;
}

function normalizeOrigin(value: string | undefined): string | null {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue.replace(/\/+$/, '');
}

function getBrowserOrigin(): string | null {
  try {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin;

    if (origin === undefined || origin.length === 0) {
      return null;
    }

    return origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}
