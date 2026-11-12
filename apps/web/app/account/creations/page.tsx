import type { JSX } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { creatorAuthEnvironment, creatorAuthPageHostAllowed } from '../../serverCreatorAccountAuth';
import MyCreationsClient from './MyCreationsClient';

export const dynamic = 'force-dynamic';

export default async function MyCreationsPage(): Promise<JSX.Element> {
  const config = creatorAuthEnvironment();
  if (!config || !creatorAuthPageHostAllowed(config, (await headers()).get('host'))) notFound();
  return <MyCreationsClient />;
}
