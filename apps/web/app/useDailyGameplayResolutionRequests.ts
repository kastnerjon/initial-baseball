import { useEffect, useState } from 'react';
import {
  createDailyGameplayResolutionClient,
  type PendingDailyResolutionAction,
} from './dailyGameplayResolutionClient';

type DailyGameplayResolutionRequests = {
  pendingAction: PendingDailyResolutionAction | null;
  resolveAtBat: ReturnType<typeof createDailyGameplayResolutionClient>['resolveAtBat'];
  invalidate: () => void;
};

export function useDailyGameplayResolutionRequests(
  onErrorChange: (message: string | null) => void,
): DailyGameplayResolutionRequests {
  const [pendingAction, setPendingAction] = useState<PendingDailyResolutionAction | null>(null);
  const [client] = useState(() => createDailyGameplayResolutionClient({
    onPendingActionChange: setPendingAction,
    onErrorChange,
  }));

  useEffect(() => () => {
    client.invalidateSilently();
  }, [client]);

  return {
    pendingAction,
    resolveAtBat: client.resolveAtBat,
    invalidate: client.invalidate,
  };
}
