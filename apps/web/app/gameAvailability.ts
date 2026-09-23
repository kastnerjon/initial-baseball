export function isClassicInningEnabled(
  value: string | undefined = process.env.CLASSIC_INNING_ENABLED,
): boolean {
  return value === 'true';
}
