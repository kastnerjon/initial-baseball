import React, { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { CustomNineCreatorView } from '../admin/custom-nine/CustomNineCreatorView';
import { isCustomLineupV2GameplayTransportEnabled } from '../serverCustomLineupV2GameplayHttp';
import '../admin/custom-nine/custom-nine-creator.css';

export const dynamic = 'force-dynamic';

/** Default-off guest draft builder. Issuance is separately account-gated by the server. */
export default function CreateLineupPage(): JSX.Element {
  if (process.env.CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED !== 'true'
    || !isCustomLineupV2GameplayTransportEnabled()) notFound();
  return <CustomNineCreatorView mode="v2" audience="public" gameplayAvailable />;
}
