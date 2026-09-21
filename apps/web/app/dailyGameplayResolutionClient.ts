import type { DailyResolutionResponse } from './dailyRuntimeContracts';
import {
  createDailyGameplayRequestController,
  postDailyGameplayJson,
} from './dailyGameplayRequestController';

export type PendingDailyResolutionAction = 'guess' | 'give_up';

export type DailyGameplayResolutionAction =
  | { submittedPlayerId: string }
  | { giveUp: true };

type DailyGameplayResolutionClientCallbacks = {
  onPendingActionChange: (action: PendingDailyResolutionAction | null) => void;
  onErrorChange: (message: string | null) => void;
};

type DailyGameplayResolutionRequest = {
  progressionToken: string;
  action: DailyGameplayResolutionAction;
  onSuccess: (response: DailyResolutionResponse) => void;
};

type PostDailyResolutionJson = (
  path: string,
  body: Record<string, unknown>,
) => Promise<DailyResolutionResponse>;

export type DailyGameplayResolutionClient = {
  resolveAtBat(request: DailyGameplayResolutionRequest): Promise<boolean>;
  invalidate(): void;
  invalidateSilently(): void;
};

export function createDailyGameplayResolutionClient(
  callbacks: DailyGameplayResolutionClientCallbacks,
  postJson: PostDailyResolutionJson = (path, body) => postDailyGameplayJson<DailyResolutionResponse>(path, body),
): DailyGameplayResolutionClient {
  const requestController = createDailyGameplayRequestController();

  return {
    resolveAtBat,
    invalidate,
    invalidateSilently,
  };

  function resolveAtBat({
    progressionToken,
    action,
    onSuccess,
  }: DailyGameplayResolutionRequest): Promise<boolean> {
    return requestController.request({
      onStart: () => {
        callbacks.onPendingActionChange('giveUp' in action ? 'give_up' : 'guess');
        callbacks.onErrorChange(null);
      },
      execute: () => postJson('/api/daily/resolve', { progressionToken, ...action }),
      onSuccess,
      onError: () => {
        callbacks.onErrorChange('The Daily game could not complete that action. Please try again.');
      },
      onSettled: () => {
        callbacks.onPendingActionChange(null);
      },
    });
  }

  function invalidate(): void {
    requestController.invalidate();
    callbacks.onPendingActionChange(null);
  }

  function invalidateSilently(): void {
    requestController.invalidate();
  }
}
