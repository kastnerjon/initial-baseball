import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // TODO: Implement `create-league`.
  // Required pattern:
  // 1. Authenticate user.
  // 2. Validate request body.
  // 3. Run server-authoritative mutation.
  // 4. Write event/report/league rows as applicable.
  // 5. Return sanitized response.

  return new Response(JSON.stringify({ ok: false, error: 'Not implemented yet' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
});
