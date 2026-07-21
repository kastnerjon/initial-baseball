import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  ServerSupabaseConfigurationError,
  createServerSupabaseClient,
} from './serverSupabaseClient';

const SUPABASE_URL = 'https://initial-baseball.supabase.co';
const SERVICE_ROLE_KEY = 'server-service-role-key';

describe('server-only Supabase client', () => {
  it('uses only the server URL and service-role key with browser auth persistence disabled', () => {
    const client = {} as SupabaseClient;
    const createClient = vi.fn(
      (_url: string, _key: string, _options: unknown): SupabaseClient => client,
    );

    expect(createServerSupabaseClient({
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    }, createClient)).toBe(client);
    expect(createClient).toHaveBeenCalledWith(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });

  it('does not fall back to public Supabase variables', () => {
    const createClient = createClientStub();

    expect(() => createServerSupabaseClient({
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
    }, createClient)).toThrowError(expect.objectContaining({
      message: expect.stringContaining('SUPABASE_URL'),
    }));
    expect(createClient).not.toHaveBeenCalled();
  });

  it('fails closed for incomplete or invalid server configuration', () => {
    const cases: Array<[Record<string, string | undefined>, string]> = [
      [{ SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, 'SUPABASE_URL'],
      [{ SUPABASE_URL: 'not-a-url', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, 'SUPABASE_URL'],
      [{ SUPABASE_URL }, 'SUPABASE_SERVICE_ROLE_KEY'],
    ];

    for (const [environment, variableName] of cases) {
      const createClient = createClientStub();

      expect(() => createServerSupabaseClient(environment, createClient)).toThrowError(
        expect.objectContaining({ message: expect.stringContaining(variableName) }),
      );
      expect(createClient).not.toHaveBeenCalled();
    }
  });

  it('uses a distinct configuration error type', () => {
    expect(() => createServerSupabaseClient({}, createClientStub()))
      .toThrow(ServerSupabaseConfigurationError);
  });
});

function createClientStub() {
  return vi.fn(
    (_url: string, _key: string, _options: unknown): SupabaseClient => (
      {} as SupabaseClient
    ),
  );
}
