import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // TODO: Implement `claim-anonymous-history`.
  // Daily functions must support anonymous users where appropriate and must not reveal player names before completion.

  return new Response(JSON.stringify({ ok: false, error: 'Not implemented yet' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
});
