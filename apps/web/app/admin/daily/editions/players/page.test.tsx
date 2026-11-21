import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
import { headers } from 'next/headers';
import Page from './page';

const AUTH = 'Basic ' + Buffer.from('editor:a-development-only-admin-password').toString('base64');
const props = (params: Record<string,string|string[]|undefined>) => ({ searchParams: Promise.resolve(params) });
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
  vi.stubEnv('DAILY_ADMIN_PASSWORD', 'a-development-only-admin-password');
  vi.mocked(headers).mockResolvedValue(new Headers({ authorization: AUTH, 'sec-fetch-site': 'same-origin' }) as never);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('restricted private player lookup page', () => {
  it('is off before auth when the exact flag is absent', async () => {
    for (const value of ['', 'false', 'TRUE', ' true ']) {
      vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', value);
      await expect(Page(props({}))).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(headers).not.toHaveBeenCalled();
  });
  it('requires authenticated first-party navigation', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers() as never);
    await expect(Page(props({}))).rejects.toThrow('NEXT_REDIRECT');
    for (const site of ['cross-site', 'same-site', null]) {
      vi.mocked(headers).mockResolvedValueOnce(new Headers({ authorization: AUTH,
        ...(site ? { 'sec-fetch-site': site } : {}) }) as never);
      await expect(Page(props({}))).rejects.toThrow('NEXT_NOT_FOUND');
    }
  });
  it('rejects old URL-based search or selection instead of echoing the query', async () => {
    for (const params of [{ q: 'private-name' }, { canonicalPlayerId: 'private-id' },
      { occurrenceId: 'private', slot: '1' }]) {
      await expect(Page(props(params))).rejects.toThrow('NEXT_NOT_FOUND');
    }
  });
  it('renders a private client lookup without a GET query form', async () => {
    const html = renderToStaticMarkup(await Page(props({})));
    expect(html).toContain('Private player lookup');
    expect(html).not.toContain('method="get"');
    expect(html).not.toContain('name="q"');
    expect(html).not.toContain('canonicalPlayerId=');
  });
});
