import 'server-only';
import { createArchiveBetaDailyEpoch } from '@initial-baseball/daily';

// Disposable archive test series; never use this as the permanent launch epoch.
export const ARCHIVE_BETA_EPOCH = createArchiveBetaDailyEpoch('2026-10-04');
