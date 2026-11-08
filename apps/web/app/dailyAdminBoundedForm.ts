/**
 * Read a bounded URL-encoded admin form without trusting Content-Length.
 * The caller owns media type, authorization and exact field validation.
 */
export async function readBoundedDailyAdminFormText(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared.trim())
      && Number(declared) > maxBytes) return null;
  if (request.body === null) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch { return null; }
  finally { reader.releaseLock(); }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return null; }
}
