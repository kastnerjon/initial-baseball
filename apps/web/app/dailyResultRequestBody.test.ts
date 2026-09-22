import { describe, expect, it } from 'vitest';
import {
  DAILY_RESULT_REQUEST_BODY_MAX_BYTES,
  readDailyResultJsonBody,
} from './dailyResultRequestBody';

describe('daily result request body reader', () => {
  it('accepts valid JSON exactly at the byte ceiling', async () => {
    const body = JSON.stringify('a'.repeat(DAILY_RESULT_REQUEST_BODY_MAX_BYTES - 2));
    const request = createRequest(body);

    expect(new TextEncoder().encode(body).byteLength).toBe(DAILY_RESULT_REQUEST_BODY_MAX_BYTES);
    await expect(readDailyResultJsonBody(request)).resolves.toEqual({
      ok: true,
      value: 'a'.repeat(DAILY_RESULT_REQUEST_BODY_MAX_BYTES - 2),
    });
  });

  it('rejects one byte over the ceiling without relying on Content-Length', async () => {
    const body = JSON.stringify('a'.repeat(DAILY_RESULT_REQUEST_BODY_MAX_BYTES - 1));
    const request = createRequest(body);

    expect(request.headers.get('content-length')).toBeNull();
    expect(new TextEncoder().encode(body).byteLength).toBe(DAILY_RESULT_REQUEST_BODY_MAX_BYTES + 1);
    await expect(readDailyResultJsonBody(request)).resolves.toEqual({
      ok: false,
      error: 'payload_too_large',
    });
  });

  it('counts actual bytes when Content-Length understates the body', async () => {
    const body = JSON.stringify('a'.repeat(DAILY_RESULT_REQUEST_BODY_MAX_BYTES));

    await expect(readDailyResultJsonBody(createRequest(body, { 'content-length': '1' })))
      .resolves.toEqual({ ok: false, error: 'payload_too_large' });
  });

  it('rejects an oversized declared length before JSON parsing', async () => {
    await expect(readDailyResultJsonBody(createRequest('{}', {
      'content-length': String(DAILY_RESULT_REQUEST_BODY_MAX_BYTES + 1),
    }))).resolves.toEqual({ ok: false, error: 'payload_too_large' });
  });

  it('keeps malformed JSON distinct from the byte-limit result', async () => {
    await expect(readDailyResultJsonBody(createRequest('{'))).resolves.toEqual({
      ok: false,
      error: 'invalid_json',
    });
  });
});

function createRequest(body: string, extraHeaders: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/daily/results', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body,
  });
}
