export type FeatureFlagKey =
  | 'random_opponents_enabled'
  | 'chat_enabled'
  | 'chat_links_enabled'
  | 'chat_media_enabled'
  | 'league_lite_enabled'
  | 'custom_stats_picker_enabled'
  | 'practice_mode_enabled'
  | 'daily_inning_enabled';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_ALPHA_FEATURE_FLAGS: FeatureFlags = {
  random_opponents_enabled: true,
  chat_enabled: true,
  chat_links_enabled: false,
  chat_media_enabled: false,
  league_lite_enabled: true,
  custom_stats_picker_enabled: true,
  practice_mode_enabled: true,
  daily_inning_enabled: true,
};
