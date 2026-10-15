import React, { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { isCustomLineupV2GameplayTransportEnabled } from '../../serverCustomLineupV2GameplayHttp';
import { CustomLineupGame } from '../CustomLineupGame';
import '../custom-lineup.css';

export const dynamic = 'force-dynamic';

/** Activation is separately approved. Until then every Custom v2 page is 404,
 * including for a syntactically valid ID, before a database read can occur.
 */
export default async function CustomLineupPage({
  params,
}: { params: Promise<{ puzzleId: string }> }): Promise<JSX.Element> {
  if (!isCustomLineupV2GameplayTransportEnabled()) notFound();
  const { puzzleId } = await params;
  try { validateCustomLineupPuzzleId(puzzleId); }
  catch { notFound(); }
  return <CustomLineupGame puzzleId={puzzleId} />;
}
