type DailyGameplayRequestCallbacks<T> = {
  execute: () => Promise<T>;
  onStart: () => void;
  onSuccess: (value: T) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

export type DailyGameplayRequestController = {
  request<T>(callbacks: DailyGameplayRequestCallbacks<T>): Promise<boolean>;
  invalidate(): void;
};

type RequestIdentity = {
  generation: number;
  requestId: number;
};

export function createDailyGameplayRequestController(): DailyGameplayRequestController {
  let generation = 0;
  let nextRequestId = 0;
  let activeRequest: RequestIdentity | null = null;

  return {
    request,
    invalidate,
  };

  async function request<T>(callbacks: DailyGameplayRequestCallbacks<T>): Promise<boolean> {
    if (activeRequest !== null) return false;

    const requestIdentity = {
      generation,
      requestId: ++nextRequestId,
    };
    activeRequest = requestIdentity;

    try {
      callbacks.onStart();
      const value = await callbacks.execute();
      if (isCurrent(requestIdentity)) callbacks.onSuccess(value);
    } catch (error) {
      if (isCurrent(requestIdentity)) callbacks.onError(error);
    } finally {
      if (isCurrent(requestIdentity)) {
        activeRequest = null;
        callbacks.onSettled();
      }
    }

    return true;
  }

  function invalidate(): void {
    generation += 1;
    activeRequest = null;
  }

  function isCurrent(requestIdentity: RequestIdentity): boolean {
    return requestIdentity.generation === generation
      && activeRequest?.generation === requestIdentity.generation
      && activeRequest.requestId === requestIdentity.requestId;
  }
}

export async function postDailyGameplayJson<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}.`);
  }
  return payload;
}
