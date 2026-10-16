import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw Error('NOT_FOUND'); }),
}));
vi.mock('../../serverCustomLineupV2GameplayHttp', () => ({
  isCustomLineupV2GameplayTransportEnabled: vi.fn(() => false),
}));
vi.mock('../CustomLineupGame', () => ({
  CustomLineupGame: ({ puzzleId }: { puzzleId: string }) =>
    React.createElement('div', {'data-testid':'custom-game'}, puzzleId),
}));
import { isCustomLineupV2GameplayTransportEnabled }
  from '../../serverCustomLineupV2GameplayHttp';
import CustomLineupPage, { metadata } from './page';

const ID='custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
beforeEach(()=>{vi.clearAllMocks();vi.mocked(isCustomLineupV2GameplayTransportEnabled).mockReturnValue(false);});
describe('Custom v2 page release boundary',()=>{
  it('keeps every unlisted challenge non-indexable without exposing challenge details',()=>{
    expect(metadata.title).toBe('Custom Lineup | Initial Baseball');
    expect(metadata.description).toBe('An unlisted baseball initials challenge.');
    expect(metadata.robots).toEqual({ index: false, follow: false, nocache: true });
    expect(metadata.referrer).toBe('no-referrer');
    const exported = JSON.stringify(metadata);
    for (const forbidden of [ID, 'ibp_', 'canonicalPlayerIds', 'clueSnapshot', 'PRIVATE_ANSWER']) {
      expect(exported).not.toContain(forbidden);
    }
  });

  it('404s every challenge when flag is off, even a valid v2 identifier',async()=>{
    await expect(CustomLineupPage({params:Promise.resolve({puzzleId:ID})}))
      .rejects.toThrow('NOT_FOUND');
    expect(isCustomLineupV2GameplayTransportEnabled).toHaveBeenCalledOnce();
  });
  it('rejects legacy and malformed IDs even when enabled',async()=>{
    vi.mocked(isCustomLineupV2GameplayTransportEnabled).mockReturnValue(true);
    for(const id of ['daily-1','custom-nine-v1-123e4567-e89b-42d3-a456-426614174000','bad']){
      await expect(CustomLineupPage({params:Promise.resolve({puzzleId:id})}))
        .rejects.toThrow('NOT_FOUND');
    }
  });
  it('renders only the opaque authorized challenge ID when explicitly enabled',async()=>{
    vi.mocked(isCustomLineupV2GameplayTransportEnabled).mockReturnValue(true);
    const page=await CustomLineupPage({params:Promise.resolve({puzzleId:ID})});
    const html=renderToStaticMarkup(page);
    expect(html).toContain(ID);
    expect(html).not.toContain('canonicalPlayerIds');
    expect(html).not.toContain('PRIVATE_ANSWER');
  });
});
