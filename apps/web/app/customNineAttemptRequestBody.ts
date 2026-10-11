/**
 * Bodyless Custom Nine attempt mutations must accept an empty POST stream
 * without buffering untrusted user input. Shared with attempt bootstrap.
 */
export async function hasUnexpectedCustomNinePostBody(request: Request): Promise<boolean> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && contentLength !== '0') return true;
  if (request.body === null) return false;
  const reader = request.body.getReader();
  try {
    for (let chunk = 0; chunk < 8; chunk++) {
      const { done, value } = await reader.read();
      if (done) return false;
      if (value.byteLength > 0) return true;
    }
    // Malformed endless sequence of empty chunks: fail closed.
    return true;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
