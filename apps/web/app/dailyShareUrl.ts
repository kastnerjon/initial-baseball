const DEFAULT_DAILY_SHARE_PATH = '/';

export function createDailyShareUrl(path: '/' | '/classic' = DEFAULT_DAILY_SHARE_PATH): string {
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  if (configuredOrigin !== null) {
    return `${configuredOrigin}${path}`;
  }

  const browserOrigin = getBrowserOrigin();

  if (browserOrigin !== null) {
    return `${browserOrigin}${path}`;
  }

  return path;
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
