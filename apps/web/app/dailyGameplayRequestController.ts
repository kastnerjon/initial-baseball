'use client';

export type DailyGameplayRequestToken = Readonly<{
  epoch: number;
  requestId: number;
}>;

export function createDailyGameplayRequestController() {
  let epoch = 0;
  let nextRequestId = 0;
  let current: DailyGameplayRequestToken | null = null;

  function isCurrent(token: DailyGameplayRequestToken): boolean {
    return current !== null
      && current.epoch === token.epoch
      && current.requestId === token.requestId;
  }

  return {
    begin(): DailyGameplayRequestToken | null {
      if (current !== null) return null;
      const token = { epoch, requestId: ++nextRequestId };
      current = token;
      return token;
    },

    isCurrent,

    finish(token: DailyGameplayRequestToken): boolean {
      if (!isCurrent(token)) return false;
      current = null;
      return true;
    },

    invalidate(): void {
      epoch += 1;
      current = null;
    },
  };
}
