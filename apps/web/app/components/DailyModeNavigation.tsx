import type { JSX } from 'react';

type DailyModePath = '/' | '/classic';

type DailyModeNavigationProps = {
  currentPath: DailyModePath;
  classicInningEnabled: boolean;
};

export function DailyModeNavigation({
  currentPath,
  classicInningEnabled,
}: DailyModeNavigationProps): JSX.Element | null {
  if (!classicInningEnabled) {
    return null;
  }

  return (
    <nav className="daily-mode-nav" aria-label="Game mode">
      <a
        className="daily-mode-link"
        href="/"
        aria-current={currentPath === '/' ? 'page' : undefined}
      >
        Daily Nine
      </a>
      <a
        className="daily-mode-link"
        href="/classic"
        aria-current={currentPath === '/classic' ? 'page' : undefined}
      >
        Classic Inning
      </a>
    </nav>
  );
}
