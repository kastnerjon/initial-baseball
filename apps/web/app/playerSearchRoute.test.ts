import { expect, it, vi } from 'vitest';
import { GET } from './api/players/search/route';

vi.mock('./serverCanonicalData', () => ({
  getCanonicalSearchCandidates: () => [
    { id: 'alex', displayName: 'Alex Rodriguez', aliases: [] },
    { id: 'ozzie', displayName: 'Ozzie Albies', aliases: [] },
    { id: 'jo', displayName: 'Jo Adell', aliases: [] },
  ],
}));

it.each(['a r', 'o a', ' A / R '])('public search returns no suggestions for %s', async query => {
  const response = GET(new Request(`https://example.test/api/players/search?q=${encodeURIComponent(query)}`));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ results: [] });
});

it('public search still accepts a real name fragment', async () => {
  const response = GET(new Request('https://example.test/api/players/search?q=o+al'));
  expect(await response.json()).toEqual({ results: [expect.objectContaining({ playerId: 'ozzie' })] });
});
