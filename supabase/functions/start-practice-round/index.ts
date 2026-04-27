// Placeholder Edge Function.
// Purpose: choose a random canonical player for Practice Mode and return a safe practice payload.
// Must reuse shared player/hint/guess logic once the backend function build is wired.

export default async function startPracticeRound() {
  return new Response(JSON.stringify({ ok: false, error: 'Not implemented yet.' }), {
    status: 501,
    headers: { 'content-type': 'application/json' },
  });
}
