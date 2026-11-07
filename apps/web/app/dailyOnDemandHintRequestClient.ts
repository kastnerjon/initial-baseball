import type { DailyHintConfig } from '@initial-baseball/shared';
import type { DailyHintBundle } from './dailyRuntimeContracts';
import {
  createDailyGameplayRequestController,
  type DailyGameplayRequestController,
} from './dailyGameplayRequestController';
import {
  applyOnDemandDailyHintReveal,
} from './dailyOnDemandHintReveal';

type HintRequest = {
  progressionToken: string;
  hintBundle: DailyHintBundle;
  hintConfig: DailyHintConfig;
  onSuccess: (value: ReturnType<typeof applyOnDemandDailyHintReveal>) => void;
};

type Callbacks = {
  onPendingChange: (pending: boolean) => void;
  onErrorChange: (message: string | null) => void;
};

/**
 * An endpoint-independent, generation-fenced browser request controller for
 * on-demand clue delivery. The caller supplies an already edition-bound server
 * transport; never route an official edition through the legacy Daily endpoint.
 */
export function createDailyOnDemandHintRequestClient(
  callbacks: Callbacks,
  postAuthorizedReveal: (progressionToken: string) => Promise<unknown>,
  controller: DailyGameplayRequestController = createDailyGameplayRequestController(),
) {
  return {
    reveal(request: HintRequest): Promise<boolean> {
      return controller.request({
        onStart: () => {
          callbacks.onPendingChange(true);
          callbacks.onErrorChange(null);
        },
        execute: () => postAuthorizedReveal(request.progressionToken),
        onSuccess: value => {
          request.onSuccess(applyOnDemandDailyHintReveal(
            request.hintBundle, request.hintConfig, request.progressionToken, value,
          ));
        },
        onError: () => {
          // Never surface provider/token/hint text in a browser error.
          callbacks.onErrorChange('The next hint could not be loaded. Please try again.');
        },
        onSettled: () => { callbacks.onPendingChange(false); },
      });
    },
    invalidate(): void {
      controller.invalidate();
      callbacks.onPendingChange(false);
    },
    invalidateSilently(): void {
      controller.invalidate();
    },
  };
}
