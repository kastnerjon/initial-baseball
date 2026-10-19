import React, { type JSX } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { isCustomLineupV2GameplayTransportEnabled } from '../../serverCustomLineupV2GameplayHttp';
import { readCustomLineupV2DisplayTitle } from '../../serverCustomLineupV2DisplayTitle';
import { CustomLineupGame } from '../CustomLineupGame';
import '../custom-lineup.css';

export const dynamic = 'force-dynamic';

/** An unlisted challenge URL is not a published community listing.
 * Generic metadata must not contain puzzle IDs, answers or frozen clues.
 */
export const metadata: Metadata = {
  title: 'Custom Lineup | Initial Baseball',
  description: 'An unlisted baseball initials challenge.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

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
  const displayTitle = await readCustomLineupV2DisplayTitle(puzzleId);
  return <CustomLineupGame puzzleId={puzzleId} displayTitle={displayTitle} />;
}
