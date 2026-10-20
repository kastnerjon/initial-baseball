import { describe, expect, it, vi } from 'vitest';

// Mock only the source boundary; exercise the real shared engine and route.
vi.mock('../../../serverCanonicalData', () => ({
  getCanonicalSearchCandidates: () => [{
    id: 'ibp_9ca187df8e6aa4162534',
    displayName: 'Chase Utley',
    aliases: ['Chase Cameron Utley'],
    firstYear: 2003,
    lastYear: 2018,
    primaryPosition: '2B',
  }],
}));
import { GET } from './route';

describe.each(['/', '/create'])('shared autocomplete for %s', caller => {
  it('rejects hidden middle-name fragments while retaining natural displayed search', async () => {
    for (const [query, expected] of [['Cam u', []], ['chase u', ['Chase Utley']], ['utley', ['Chase Utley']]] as const) {
      const response = GET(new Request('https://example.test/api/players/search?q=' + encodeURIComponent(query), {
        headers: { referer: 'https://example.test' + caller },
      }));
      expect(response.status).toBe(200);
      const payload = await response.json() as { results: Array<{ displayName: string }> };
      expect(payload.results.map((p: { displayName: string }) => p.displayName)).toEqual(expected);
    }
  });

  it('still rejects initials-only answer enumeration', async () => {
    const response = GET(new Request('https://example.test/api/players/search?q=c%20u'));
    const payload = await response.json() as { results: unknown[] };
    expect(payload.results).toEqual([]);
  });
});
