export function formatDailyAwardedPoints(points: number): string {
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}
