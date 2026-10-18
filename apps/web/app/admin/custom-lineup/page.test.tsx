import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw Error('REDIRECT'); }) }));
vi.mock('../../dailyAdminAuthorization', () => ({
  requireDailyAdminPrincipal: vi.fn(),
  DailyAdminAuthorizationError: class extends Error { constructor(readonly kind: string) { super(kind); } },
}));
vi.mock('../../serverCustomLineupV2GameplayHttp', () => ({
  isCustomLineupV2GameplayTransportEnabled: vi.fn(() => false),
}));
import { DailyAdminAuthorizationError, requireDailyAdminPrincipal } from '../../dailyAdminAuthorization';
import { isCustomLineupV2GameplayTransportEnabled } from '../../serverCustomLineupV2GameplayHttp';
import AdminCustomLineupPage from './page';

beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireDailyAdminPrincipal).mockReset(); });
describe('admin Custom Lineup share availability', () => {
  it.each([false, true])('passes server-resolved gameplay availability %s after admin authorization', async enabled => {
    vi.mocked(isCustomLineupV2GameplayTransportEnabled).mockReturnValue(enabled);
    const page = await AdminCustomLineupPage();
    expect(page.props).toEqual({ mode: 'v2', gameplayAvailable: enabled });
    expect(requireDailyAdminPrincipal).toHaveBeenCalledOnce();
  });
  it('does not expose the creator or inspect gameplay availability without authorization', async () => {
    vi.mocked(requireDailyAdminPrincipal).mockImplementation(() => {
      throw new DailyAdminAuthorizationError('unauthorized', 'test unauthorized');
    });
    await expect(AdminCustomLineupPage()).rejects.toThrow('REDIRECT');
    expect(isCustomLineupV2GameplayTransportEnabled).not.toHaveBeenCalled();
  });
});
