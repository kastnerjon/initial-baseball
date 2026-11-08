import { describe, expect, it } from 'vitest';
import { readBoundedDailyAdminFormText } from './dailyAdminBoundedForm';

function request(text: string, headers: Record<string, string> = {}): Request {
  return new Request('https://initial.test/admin/form', {
    method: 'POST', headers, body: text,
  });
}

describe('bounded Daily admin urlencoded form body', () => {
  it('accepts a valid small UTF-8 form within the specified limit', async () => {
    expect(await readBoundedDailyAdminFormText(request('key=value&name=José'), 128))
      .toBe('key=value&name=José');
  });

  it('rejects actual oversized bytes despite a forged small declared size', async () => {
    const oversized = request('a=' + 'x'.repeat(4000), { 'content-length': '10' });
    expect(await readBoundedDailyAdminFormText(oversized, 1024)).toBeNull();
  });

  it('rejects declared oversized, missing bodies and invalid size configurations', async () => {
    expect(await readBoundedDailyAdminFormText(
      request('a=x', { 'content-length': '100000' }), 128,
    )).toBeNull();
    expect(await readBoundedDailyAdminFormText(
      new Request('https://initial.test/', { method: 'POST' }), 128,
    )).toBeNull();
    expect(await readBoundedDailyAdminFormText(request('a=x'), 0)).toBeNull();
  });

  it('uses UTF-8 byte count, including multi-byte Unicode', async () => {
    const multi = request('title=' + 'é'.repeat(20));
    expect(await readBoundedDailyAdminFormText(multi, 30)).toBeNull();
  });
});
