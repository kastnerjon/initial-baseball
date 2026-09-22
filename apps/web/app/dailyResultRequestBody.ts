export const DAILY_RESULT_REQUEST_BODY_MAX_BYTES = 16 * 1024;

type DailyResultRequestBodyRead =
  | { ok: true; value: unknown }
  | { ok: false; error: 'invalid_json' | 'payload_too_large' };

export async function readDailyResultJsonBody(
  request: Request,
  maxBytes = DAILY_RESULT_REQUEST_BODY_MAX_BYTES,
): Promise<DailyResultRequestBodyRead> {
  if (declaredBodyTooLarge(request.headers.get('content-length'), maxBytes)) {
    return { ok: false, error: 'payload_too_large' };
  }

  if (request.body === null) return { ok: false, error: 'invalid_json' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The request is already rejected. A failed cancel must not hide that result.
        }
        return { ok: false, error: 'payload_too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: 'invalid_json' };
  } finally {
    reader.releaseLock();
  }

  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(joinChunks(chunks, totalBytes))),
    };
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
}

function declaredBodyTooLarge(rawLength: string | null, maxBytes: number): boolean {
  if (rawLength === null || !/^\d+$/.test(rawLength.trim())) return false;
  return Number(rawLength) > maxBytes;
}

function joinChunks(chunks: readonly Uint8Array[], totalBytes: number): Uint8Array {
  if (chunks.length === 1) return chunks[0] ?? new Uint8Array();

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
