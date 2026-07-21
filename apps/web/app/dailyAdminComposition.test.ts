import type { DailyPuzzleRepository } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createDailyAdminContext } from './dailyAdminComposition';

const ADMIN_USERNAME = 'daily-editor';
const ADMIN_PASSWORD = 'a-secure-admin-password-with-32-chars';
const ENVIRONMENT = {
  DAILY_ADMIN_USERNAME: ADMIN_USERNAME,
  DAILY_ADMIN_PASSWORD: ADMIN_PASSWORD,
  SUPABASE_URL: 'https://initial-baseball.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-service-role-key',
};

describe('Daily admin composition', () => {
  it('authorizes first, then composes the service-role client and repository', () => {
    const client = {} as SupabaseClient;
    const repository = createRepositoryStub();
    const createSupabaseClient = vi.fn().mockReturnValue(client);
    const createRepository = vi.fn().mockReturnValue(repository);

    const context = createDailyAdminContext({
      authorizationHeader: basicAuthorization(ADMIN_USERNAME, ADMIN_PASSWORD),
      environment: ENVIRONMENT,
      dependencies: { createSupabaseClient, createRepository },
    });

    expect(context).toEqual({
      actorId: ADMIN_USERNAME,
      principal: { actorId: ADMIN_USERNAME },
      repository,
    });
    expect(createSupabaseClient).toHaveBeenCalledWith(ENVIRONMENT);
    expect(createRepository).toHaveBeenCalledWith(client);
  });

  it('never constructs or exposes the service-role client for an unauthorized request', () => {
    const createSupabaseClient = vi.fn();
    const createRepository = vi.fn();

    expect(() => createDailyAdminContext({
      authorizationHeader: null,
      environment: ENVIRONMENT,
      dependencies: { createSupabaseClient, createRepository },
    })).toThrowError(expect.objectContaining({ kind: 'unauthorized' }));

    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(createRepository).not.toHaveBeenCalled();
  });
});

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

function createRepositoryStub(): DailyPuzzleRepository {
  return {
    getByDate: vi.fn(),
    listByDateRange: vi.fn(),
    save: vi.fn(),
  };
}
