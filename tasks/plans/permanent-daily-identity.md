# Permanent Daily identity and launch epoch

Status: implemented foundation

## Scope contract

- **Goal:** define a portable permanent-series identity that can restart public numbering at Daily #1 on a later explicitly chosen launch date.
- **Owning layer:** `packages/daily`.
- **In scope:** a versioned permanent series identifier, validated launch-epoch value, date -> Daily number mapping, Daily number -> date mapping, pre-launch non-membership, focused tests, and canonical documentation.
- **Out of scope:** choosing or configuring the actual launch date, importing beta history, freezing/storing puzzle content, Supabase migrations, archive routes, browser history, replay policy, UI, or scoring changes.
- **Acceptance checks:** launch date maps to #1; later calendar dates increment exactly once per date; pre-launch dates return no permanent identity; leap-day/DST-adjacent dates remain calendar-stable; invalid dates/numbers fail; current beta numbering is untouched.
- **Stop conditions:** any requirement for persisted puzzle content, public routing, local storage, or launch-product selection becomes a later bounded PR.

## Contract

The permanent series is versioned as `permanent-v1`.

A `PermanentDailyLaunchEpoch` contains that series version plus an explicit `YYYY-MM-DD` launch date. The repository deliberately does **not** provide a configured launch-date constant yet.

A `PermanentDailyIdentity` contains:

- permanent series version;
- Pacific Daily calendar date;
- permanent Daily number.

`resolvePermanentDailyIdentityForDate` returns null before the launch epoch, #1 on the launch date, then increments by one per calendar date.

`resolvePermanentDailyIdentityForNumber` supplies the inverse mapping needed by future archive navigation.

All arithmetic is UTC calendar-day arithmetic over already-resolved Daily date strings. Time of day and daylight-saving offsets therefore do not alter numbering.

## Important boundary

Permanent series identity is **not** the frozen puzzle snapshot.

A later persistence PR must bind this identity to immutable issued puzzle content before any archive route can claim historical replay. That snapshot boundary is what prevents later lineup/profile/data-generation changes from silently changing an already-issued permanent Daily.

Current beta `DAILY_PUZZLE_EPOCH` and `getDailyPuzzleNumber` remain untouched and disposable.
