import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface ServerSupabaseClientOptions {
  auth: {
    autoRefreshToken: false;
    detectSessionInUrl: false;
    persistSession: false;
  };
}

type ServerSupabaseClientFactory = (
  supabaseUrl: string,
  serviceRoleKey: string,
  options: ServerSupabaseClientOptions,
) => SupabaseClient;

const SERVER_SUPABASE_OPTIONS: ServerSupabaseClientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const createDefaultClient: ServerSupabaseClientFactory = (
  supabaseUrl,
  serviceRoleKey,
  options,
) => createClient(supabaseUrl, serviceRoleKey, options);

export class ServerSupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerSupabaseConfigurationError';
  }
}

export function createServerSupabaseClient(
  environment: Record<string, string | undefined> = process.env,
  createSupabaseClient: ServerSupabaseClientFactory = createDefaultClient,
): SupabaseClient {
  const supabaseUrl = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new ServerSupabaseConfigurationError(
      'SUPABASE_URL is required for the server-only Supabase client.',
    );
  }
  if (!isHttpUrl(supabaseUrl)) {
    throw new ServerSupabaseConfigurationError(
      'SUPABASE_URL must be a valid HTTP or HTTPS URL.',
    );
  }
  if (!serviceRoleKey) {
    throw new ServerSupabaseConfigurationError(
      'SUPABASE_SERVICE_ROLE_KEY is required for the server-only Supabase client.',
    );
  }

  return createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    SERVER_SUPABASE_OPTIONS,
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
