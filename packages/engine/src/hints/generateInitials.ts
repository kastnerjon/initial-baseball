const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

export function generateInitials(fullName: string): string {
  const cleaned = fullName
    .replace(/[.’']/g, '')
    .replace(/-/g, ' ')
    .trim();

  if (!cleaned) return '';

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .filter((part) => !SUFFIXES.has(part.toLowerCase()))
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
