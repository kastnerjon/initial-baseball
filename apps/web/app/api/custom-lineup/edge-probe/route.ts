import { isIP } from 'node:net';
import { verifiedVercelCreationIp } from '../../../serverCustomLineupCreationBudget';

// TEMPORARY QA-ONLY ROUTE: DO NOT MERGE. Test deployed Vercel ingress,
// then close this diagnostic PR. Never return a visitor's IP or any secret.
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };
const TEST_SENTINELS = new Set(['203.0.113.79', '198.51.100.79']);

export async function GET(request: Request): Promise<Response> {
  if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'preview') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }
  const from = request.headers.get('x-forwarded-for');
  const vercel = request.headers.get('x-vercel-forwarded-for');
  const real = request.headers.get('x-real-ip');
  return Response.json({
    previewOnly: true,
    edgeRequestIdPresent: Boolean(request.headers.get('x-vercel-id')),
    singleValidForwardedIp: from !== null && isIP(from) !== 0 && !from.includes(','),
    vercelForwardedAgrees: vercel !== null && vercel === from,
    realIpAgrees: real === null ? null : real === from,
    rejectedInjectedSentinel: !TEST_SENTINELS.has(from ?? ''),
    acceptedByExistingBudgetIpParser: verifiedVercelCreationIp(request, process.env) !== null,
  }, { headers: NO_STORE });
}
