import { useEffect, useState } from 'react';
import {
  createDailyGameplayResolutionClient,
  type PendingDailyResolutionAction,
  type PostDailyResolutionJson,
} from './dailyGameplayResolutionClient';

type DailyGameplayResolutionRequests = {
  pendingAction: PendingDailyResolutionAction | null;
  resolveAtBat: ReturnType<typeof createDailyGameplayResolutionClient>['resolveAtBat'];
  invalidate: () => void;
};

export function useDailyGameplayResolutionRequests(
  onErrorChange: (message: string | null) => void,
  transport?: { path: string; postJson: PostDailyResolutionJson },
): DailyGameplayResolutionRequests {
  const [pendingAction, setPendingAction] = useState<PendingDailyResolutionAction | null>(null);
  const [client] = useState(() => createDailyGameplayResolutionClient({
    onPendingActionChange: setPendingAction,
    onErrorChange,
  }, transport?.postJson, transport?.path));

  useEffect(() => () => {
    client.invalidateSilently();
  }, [client]);

  return {
    pendingAction,
    resolveAtBat: client.resolveAtBat,
    invalidate: client.invalidate,
  };
}
