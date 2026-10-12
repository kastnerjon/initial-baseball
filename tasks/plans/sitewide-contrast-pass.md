# Sitewide UI contrast enhancement

Status: Bounded presentation-only work, October 11, 2026.

**Goal:** Make subdued text, outlines, controls and at-bat progress much more legible across consumer Daily/Archive and Custom Nine/admin surfaces without replacing the app's design theme.

**Owning layer:** `apps/web` global visual tokens and a limited set of hardcoded component colors.

**In scope:** strengthen `--ink-soft` to >=7:1 on paper surfaces; make primary `--line` reach >=3:1 on paper; adjust decorative `--line-soft`, key input/placeholder and inactive strike markers; improve dark scoreboard separators; strengthen the connecting line on the nine-at-bat progress tracker. Automated token contrast checks. No layout or functional changes. Inherited variables automatically affect Daily, Archive and Custom/admin views.

**Out of scope:** New component design, another page redesign, theme/color identity change, dark mode, data, engine, scoring, Custom Nine gameplay transport, server/session rules, result statistics, or visual work concurrently owned by another UI chat.

**Acceptance:** Accessible contrast ratios for all global text and primary control-edge tokens against main/light backgrounds; keyboard focus remains visible; screenshots at common mobile/desktop widths have no unexpected overflow, cards remain distinct; focused tests/typecheck/file-size, independent bounded review, exact-head CI, READY Preview, and postmerge verification.

**Stop conditions:** Color changes expose an unanticipated semantic use of a token that requires broad component redesign; defer those to a separate feature rather than piling changes into this PR.

**Review fix:** All three dark scoreboard separators now meet the 3:1 contrast target over both deep-green and standard green fills; regression test evaluates the blended rgba color.

**Audit note:** Existing secondary text `#616960` contrasted about 5.2:1 on main paper but was visually subdued. Existing `--line` `#d7dbd2` was roughly 1.4:1 against light paper, below the 3:1 target for recognizable control boundaries. Improve contrast while keeping the green/red/cream palette.
