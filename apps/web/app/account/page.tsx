import { notFound } from 'next/navigation';
import AccountClient from './AccountClient';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }): Promise<JSX.Element> {
  if (process.env.CREATOR_AUTH_ENABLED !== 'true'
    || !process.env.CREATOR_AUTH_SITE_URL || !process.env.SUPABASE_URL
    || !process.env.SUPABASE_PUBLISHABLE_KEY) notFound();
  const { status } = await searchParams;
  return <AccountClient status={status} />;
}
