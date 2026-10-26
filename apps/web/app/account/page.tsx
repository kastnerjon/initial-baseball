import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import AccountClient from './AccountClient';
import { creatorAuthEnvironment, creatorAuthPageHostAllowed } from '../serverCreatorAccountAuth';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }): Promise<JSX.Element> {
  const config = creatorAuthEnvironment();
  if (!config || !creatorAuthPageHostAllowed(config, (await headers()).get('host'))) notFound();
  const { status } = await searchParams;
  return <AccountClient status={status} />;
}
