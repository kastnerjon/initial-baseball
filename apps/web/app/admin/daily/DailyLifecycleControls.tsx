import type { DailyPuzzleStatus } from '@initial-baseball/shared';
import type { JSX } from 'react';
import type { DailyAdminLifecycleAction } from '../../dailyAdminLifecycleActions';

type LifecycleAction = {
  action: DailyAdminLifecycleAction;
  label: string;
};

export function DailyLifecycleActionForm({
  puzzleDate,
  status,
}: {
  puzzleDate: string;
  status: DailyPuzzleStatus;
}): JSX.Element | null {
  const action = getLifecycleAction(status);
  if (action === null) return null;

  return (
    <form action="/admin/daily/lifecycle" method="post">
      <input type="hidden" name="puzzleDate" value={puzzleDate} />
      <input type="hidden" name="action" value={action.action} />
      <button type="submit" style={buttonStyle}>{action.label}</button>
    </form>
  );
}

export function getDailyLifecycleSuccessMessage(action: DailyAdminLifecycleAction): string {
  if (action === 'schedule') return 'Puzzle scheduled. Its revision and scheduling audit metadata were saved.';
  if (action === 'publish') return 'Puzzle published. Ordinary player replacement is now locked.';
  return 'Puzzle archived. Its published selections remain immutable.';
}

function getLifecycleAction(status: DailyPuzzleStatus): LifecycleAction | null {
  if (status === 'draft') return { action: 'schedule', label: 'Approve & schedule' };
  if (status === 'scheduled') return { action: 'publish', label: 'Publish' };
  if (status === 'published') return { action: 'archive', label: 'Archive' };
  return null;
}

const buttonStyle = {
  border: '1px solid #162116',
  borderRadius: 10,
  padding: '12px 16px',
  background: '#173326',
  color: '#f9f3e6',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
} as const;
