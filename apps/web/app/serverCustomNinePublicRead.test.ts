import {
  createCustomNineIssuedChallenge,
  createPermanentDailyIssuedClueSnapshot,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createServerCustomNinePublicReadService } from './serverCustomNinePublicRead';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const IDS = Array.from({ length: 9 }, (_, i) => 'private-canonical-player-' + (i + 1));
const SECRET_HINT = 'SECRET_HR_999_FUTURE_HINT';
const TIMESTAMP = '2026-10-09T15:00:00.000Z';

function challenge() {
  return createCustomNineIssuedChallenge({
    puzzleId: ID,
    canonicalPlayerIds: IDS,
    issuedAt: TIMESTAMP,
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: IDS.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: 'P' + (index + 1),
        hintValues: ['1980s', 'PRIVATE_TEAM', 'RF', SECRET_HINT],
      })),
    }),
  });
}

function setup(stored: unknown | null = challenge()) {
  const client = {} as SupabaseClient;
  const repository: CustomNineIssuedChallengeRepository = {
    insertIfAbsent: vi.fn(async ch => ({ status: 'inserted' as const, challenge: ch })),
    getById: vi.fn(async () => stored),
  };
  const dependencies = {
    createSupabaseClient: vi.fn((_environment: Record<string, string | undefined>) => client),
    createRepository: vi.fn((_client: SupabaseClient) => repository),
  };
  const environment = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private' };
  return { read: createServerCustomNinePublicReadService({ environment, dependencies }).read,
    repository, dependencies, client, environment };
}

describe('Custom Nine public redacted read service', () => {
  it('returns exact nine ordered initials with only explicitly approved public fields', async () => {
    const { read, repository, dependencies, client, environment } = setup();
    const result = await read(ID);
    expect(result).toEqual({
      puzzleId: ID, rulesetVersion: 'points-v4',
      atBats: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1, initials: 'P' + (i + 1) })),
    });
    expect(Object.keys(result ?? {})).toEqual(['puzzleId', 'rulesetVersion', 'atBats']);
    const json = JSON.stringify(result);
    for (const secret of [...IDS, SECRET_HINT, 'PRIVATE_TEAM', TIMESTAMP, 'hintLayout', 'canonicalPlayerIds', 'clueSnapshot']) {
      expect(json).not.toContain(secret);
    }
    expect(dependencies.createSupabaseClient).toHaveBeenCalledWith(environment);
    expect(dependencies.createRepository).toHaveBeenCalledWith(client);
    expect(repository.getById).toHaveBeenCalledWith(ID);
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it.each([null, undefined, 1, '', 'custom-nine-v1-bad-id',
    'custom-nine-v1-123e4567-e89b-12d3-a456-426614174000',
    'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000/../other'])(
    'rejects malformed ID %s before touching Supabase', async invalid => {
      const { read, dependencies, repository } = setup();
      expect(await read(invalid)).toBeNull();
      expect(dependencies.createSupabaseClient).not.toHaveBeenCalled();
      expect(repository.getById).not.toHaveBeenCalled();
    });

  it('returns null for an unknown well-formed ID', async () => {
    const { read, repository } = setup(null);
    expect(await read(ID)).toBeNull();
    expect(repository.getById).toHaveBeenCalledTimes(1);
  });

  it('fails closed for an invalid or wrong-identity stored record', async () => {
    const altered = createCustomNineIssuedChallenge({
      ...challenge(), puzzleId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001',
    });
    await expect(setup(altered).read(ID)).rejects.toThrow('wrong challenge');
    await expect(setup({ schemaVersion: 2, rulesetVersion: 'points-v5' }).read(ID))
      .rejects.toThrow('Unsupported Custom Nine');
  });

  it('does not convert a repository error to a success payload', async () => {
    const { read, repository } = setup();
    vi.mocked(repository.getById).mockRejectedValueOnce(new Error('private database error'));
    await expect(read(ID)).rejects.toThrow('private database error');
  });
});
