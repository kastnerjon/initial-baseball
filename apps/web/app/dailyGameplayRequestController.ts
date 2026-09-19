export type DailyGameplayRequestController = {
  begin(): DailyGameplayRequestToken | null;
  isCurrent(token: DailyGameplayRequestToken): boolean;
  finish(token: DailyGameplayRequestToken): boolean;
  invalidate(): void;
};

type DailyGameplayRequestToken = Readonly<{
  epoch: number;
  requestId: number;
}>;

export function createDailyGameplayRequestController(): DailyGameplayRequestController {
  let epoch = 0;
  let nextRequestId = 0;
  let active: DailyGameplayRequestToken | null = null;

  function isCurrent(token: DailyGameplayRequestToken): boolean {
    return active !== null
      && active.epoch === token.epoch
      && active.requestId === token.requestId
      && epoch === token.epoch;
  }

  return {
    begin() {
      if (active !== null) return null;
      const token = { epoch, requestId: ++nextRequestId };
      active = token;
      return token;
    },
    isCurrent,
    finish(token) {
      if (!isCurrent(token)) return false;
      active = null;
      return true;
    },
    invalidate() {
      epoch += 1;
      active = null;
    },
  };
}

export async function runDailyGameplayRequest<T>({
  controller,
  request,
  onStart,
  onError,
  onFinish,
}: {
  controller: DailyGameplayRequestController;
  request: () => Promise<T>;
  onStart: () => void;
  onError: () => void;
  onFinish: () => void;
}): Promise<T | null> {
  const token = controller.begin();
  if (token === null) return null;

  onStart();
  try {
    const result = await request();
    return controller.isCurrent(token) ? result : null;
  } catch {
    if (controller.isCurrent(token)) onError();
    return null;
  } finally {
    if (controller.finish(token)) onFinish();
  }
}
