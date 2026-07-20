const DEVELOPMENT_SECRET = 'initial-baseball-development-progression-secret';

export function getDailyProgressionSecret(
  environment: Record<string, string | undefined> = process.env,
): string {
  const configuredSecret = environment.DAILY_PROGRESSION_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (environment.NODE_ENV !== 'production') {
    return DEVELOPMENT_SECRET;
  }

  throw new Error('DAILY_PROGRESSION_SECRET is required for production Daily progression tokens.');
}
