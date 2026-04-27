create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled) values
  ('random_opponents_enabled', true),
  ('chat_enabled', true),
  ('chat_links_enabled', false),
  ('chat_media_enabled', false),
  ('league_lite_enabled', true),
  ('custom_stats_picker_enabled', true),
  ('practice_mode_enabled', true),
  ('daily_inning_enabled', true)
on conflict (key) do nothing;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  external_source text,
  external_id text,
  full_name text not null,
  display_name text not null,
  primary_role text not null check (primary_role in ('hitter', 'pitcher', 'two_way')),
  primary_position text not null,
  main_decade text,
  teams_display text,
  created_at timestamptz not null default now(),
  unique (external_source, external_id)
);

create table public.player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  unique (player_id, normalized_alias)
);

create table public.player_career_stats (
  player_id uuid primary key references public.players(id) on delete cascade,
  bwar numeric,
  hr integer,
  rbi integer,
  ba numeric,
  obp numeric,
  slg numeric,
  ops numeric,
  sb integer,
  w integer,
  l integer,
  era numeric,
  whip numeric,
  k integer,
  sv integer,
  ip numeric,
  source_note text,
  updated_at timestamptz not null default now()
);

create table public.game_settings_proposals (
  id uuid primary key default gen_random_uuid(),
  proposer_user_id uuid not null references public.profiles(id),
  invitee_user_id uuid references public.profiles(id),
  invite_code text unique,
  status text not null check (status in ('pending', 'countered', 'accepted', 'declined', 'expired')) default 'pending',
  latest_proposed_by uuid not null references public.profiles(id),
  settings jsonb not null,
  created_game_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('pending', 'active', 'completed', 'forfeited', 'cancelled')) default 'active',
  settings jsonb not null,
  current_inning integer not null default 1,
  current_half text not null check (current_half in ('top', 'bottom')) default 'top',
  outs integer not null default 0,
  home_score integer not null default 0,
  away_score integer not null default 0,
  bases jsonb not null default '{"first":false,"second":false,"third":false}'::jsonb,
  winner_user_id uuid references public.profiles(id),
  created_from_proposal_id uuid references public.game_settings_proposals(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.game_settings_proposals
  add constraint game_settings_proposals_created_game_id_fkey
  foreign key (created_game_id) references public.games(id);

create table public.game_members (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('home', 'away')),
  role_state text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, side)
);

create table public.at_bats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  pitcher_user_id uuid not null references public.profiles(id),
  hitter_user_id uuid not null references public.profiles(id),
  player_id uuid not null references public.players(id),
  initials text not null,
  auto_hints jsonb not null,
  submitted_hints jsonb not null,
  revealed_hint_count integer not null default 0,
  strikes integer not null default 0,
  status text not null check (status in ('queued', 'active', 'resolved')) default 'queued',
  result text,
  inning integer not null,
  half text not null check (half in ('top', 'bottom')),
  outs_before integer not null,
  bases_before jsonb not null,
  score_before jsonb not null,
  outs_after integer,
  bases_after jsonb,
  score_after jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  at_bat_id uuid references public.at_bats(id) on delete set null,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.inning_lines (
  game_id uuid not null references public.games(id) on delete cascade,
  inning integer not null,
  half text not null check (half in ('top', 'bottom')),
  batting_side text not null check (batting_side in ('home', 'away')),
  runs integer not null default 0,
  hits integer not null default 0,
  primary key (game_id, inning, half)
);

create table public.game_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id),
  body text not null,
  moderation_status text not null default 'visible',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.blocks (
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id)
);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id),
  reported_user_id uuid not null references public.profiles(id),
  game_id uuid references public.games(id),
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id),
  message_id uuid not null references public.game_messages(id),
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references public.profiles(id),
  action_type text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  settings jsonb not null,
  status text not null check (status in ('queued', 'matched', 'cancelled', 'expired')) default 'queued',
  matched_game_id uuid references public.games(id),
  created_at timestamptz not null default now()
);

create unique index matchmaking_one_active_queue_per_user
  on public.matchmaking_queue(user_id)
  where status = 'queued';

create table public.user_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  wins integer not null default 0,
  losses integer not null default 0,
  runs_scored integer not null default 0,
  runs_allowed integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.head_to_head_stats (
  user_low_id uuid not null references public.profiles(id) on delete cascade,
  user_high_id uuid not null references public.profiles(id) on delete cascade,
  low_user_wins integer not null default 0,
  high_user_wins integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_low_id, user_high_id),
  check (user_low_id < user_high_id)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  name text not null,
  default_settings jsonb not null,
  invite_code text unique not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')) default 'member',
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table public.league_games (
  league_id uuid not null references public.leagues(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, game_id)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);



-- Daily Inning: anonymous web puzzle identity and results.
create table public.anonymous_players (
  id uuid primary key default gen_random_uuid(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  claimed_user_id uuid references public.profiles(id) on delete set null,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create table public.daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date unique not null,
  puzzle_number integer unique not null,
  status text not null check (status in ('draft', 'published', 'archived')) default 'draft',
  hint_config jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.daily_puzzle_pitches (
  id uuid primary key default gen_random_uuid(),
  daily_puzzle_id uuid not null references public.daily_puzzles(id) on delete cascade,
  pitch_number integer not null,
  player_id uuid not null references public.players(id),
  initials text not null,
  auto_hints_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (daily_puzzle_id, pitch_number)
);

create table public.daily_attempts (
  id uuid primary key default gen_random_uuid(),
  daily_puzzle_id uuid not null references public.daily_puzzles(id) on delete cascade,
  anonymous_player_id uuid references public.anonymous_players(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  runs integer not null default 0,
  hits integer not null default 0,
  outs integer not null default 0,
  share_text text,
  client_fingerprint_hash text,
  check (anonymous_player_id is not null or user_id is not null)
);

create table public.daily_pitch_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.daily_attempts(id) on delete cascade,
  daily_puzzle_pitch_id uuid not null references public.daily_puzzle_pitches(id) on delete cascade,
  pitch_number integer not null,
  initials text not null,
  outcome text not null check (outcome in ('HR', '3B', '2B', '1B', 'BUNT', 'K')),
  hints_used integer not null default 0,
  guesses_count integer not null default 0,
  struck_out boolean not null default false,
  created_at timestamptz not null default now(),
  unique (attempt_id, daily_puzzle_pitch_id)
);

-- Indexes for common app access paths. Add more once query plans are known.
create index players_display_name_idx on public.players(display_name);
create index player_aliases_normalized_alias_idx on public.player_aliases(normalized_alias);
create index game_members_user_id_idx on public.game_members(user_id);
create index at_bats_game_status_idx on public.at_bats(game_id, status);
create index game_events_game_created_at_idx on public.game_events(game_id, created_at);
create index inning_lines_game_inning_idx on public.inning_lines(game_id, inning);
create index game_messages_game_created_at_idx on public.game_messages(game_id, created_at);
create index matchmaking_queue_status_created_at_idx on public.matchmaking_queue(status, created_at);
create index league_members_user_id_idx on public.league_members(user_id);
create index league_games_league_id_idx on public.league_games(league_id);
create index push_tokens_user_id_idx on public.push_tokens(user_id);

create index anonymous_players_claimed_user_id_idx on public.anonymous_players(claimed_user_id);
create index daily_puzzles_date_status_idx on public.daily_puzzles(puzzle_date, status);
create index daily_puzzle_pitches_puzzle_idx on public.daily_puzzle_pitches(daily_puzzle_id, pitch_number);
create index daily_attempts_puzzle_user_idx on public.daily_attempts(daily_puzzle_id, user_id);
create index daily_attempts_puzzle_anonymous_idx on public.daily_attempts(daily_puzzle_id, anonymous_player_id);
create index daily_pitch_results_pitch_idx on public.daily_pitch_results(daily_puzzle_pitch_id, outcome);


-- RLS: default posture is no direct table writes from clients. Edge Functions use service role.
-- Add narrowly scoped read policies as UI work requires. Keep writes service-role-only through Edge Functions.

alter table public.profiles enable row level security;
alter table public.feature_flags enable row level security;
alter table public.players enable row level security;
alter table public.player_aliases enable row level security;
alter table public.player_career_stats enable row level security;
alter table public.game_settings_proposals enable row level security;
alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.at_bats enable row level security;
alter table public.game_events enable row level security;
alter table public.inning_lines enable row level security;
alter table public.game_messages enable row level security;
alter table public.blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.message_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.user_stats enable row level security;
alter table public.head_to_head_stats enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_games enable row level security;

alter table public.anonymous_players enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.daily_puzzle_pitches enable row level security;
alter table public.daily_attempts enable row level security;
alter table public.daily_pitch_results enable row level security;
alter table public.push_tokens enable row level security;


-- Important: no permissive client write policies are defined in the initial scaffold.
-- Edge Functions should use service-role access after authenticating and authorizing the user.

-- Practice Mode is separate from competitive records.
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.practice_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id),
  revealed_hint_count integer not null default 0,
  strikes integer not null default 0,
  result text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_practice_sessions_user_id on public.practice_sessions(user_id);
create index if not exists idx_practice_rounds_session_id on public.practice_rounds(session_id);


alter table public.practice_sessions enable row level security;
alter table public.practice_rounds enable row level security;
