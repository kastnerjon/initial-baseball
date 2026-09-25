export function generateInitials(
  fullName: string,
  terminalSuffix: 'omit' | 'include' = 'omit',
): string {
  const cleaned = fullName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,’'"]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const lastPart = parts.at(-1)?.toLowerCase();
  if (terminalSuffix === 'omit' && (lastPart === 'jr' || lastPart === 'sr')) {
    parts.pop();
  }

  return parts
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
