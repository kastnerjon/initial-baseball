import type { JSX } from 'react';
import { notFound } from 'next/navigation';
import AccountClient from './AccountClient';
import { creatorAuthEnvironment } from '../serverCreatorAccountAuth';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }): Promise<JSX.Element> {
  if (!creatorAuthEnvironment()) notFound();
  const { status } = await searchParams;
  return <AccountClient status={status} />;
}
