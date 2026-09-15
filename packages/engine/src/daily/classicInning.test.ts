import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION as CLASSIC,
  LEGACY_DAILY_RULESET_VERSION as LEGACY,
  POINTS_V1_DAILY_RULESET_VERSION as V1,
  POINTS_V2_DAILY_RULESET_VERSION as V2,
  DEFAULT_DAILY_BASE_STATE, DEFAULT_DAILY_SCORE_SUMMARY,
  isDailyRulesetVersion, isDailyPointsRulesetVersion,
  type DailyRulesetVersion, type DailyOutcome,
} from '@initial-baseball/shared';
import { applyDailyOutcomeForRuleset, createDailyPointsSummary, isDailyGameComplete,
  type DailyRulesetEngineState } from './applyDailyRuleset.js';
import { formatDailyShareText, getDailyModeName } from './formatDailyShareText.js';

function start(rulesetVersion: DailyRulesetVersion): DailyRulesetEngineState {
  return { inning: { inningNumber: 1, outs: 0, maxOuts: 3, bases: { ...DEFAULT_DAILY_BASE_STATE },
    completedAtBats: [], currentAtBat: null }, score: { ...DEFAULT_DAILY_SCORE_SUMMARY },
    points: createDailyPointsSummary(rulesetVersion, 9) };
}

function play(outcomes: DailyOutcome[], rulesetVersion: DailyRulesetVersion = CLASSIC): DailyRulesetEngineState {
  return outcomes.reduce((state, outcome) => applyDailyOutcomeForRuleset({
    ...state, rulesetVersion, outcome, totalAtBats: 9,
  }), start(rulesetVersion));
}

describe('classic-inning-v1', () => {
  it('is a distinct supported non-points policy', () => {
    expect(isDailyRulesetVersion(CLASSIC)).toBe(true);
    expect(isDailyPointsRulesetVersion(CLASSIC)).toBe(false);
    expect(isDailyRulesetVersion('classic-inning-v2')).toBe(false);
    expect(getDailyModeName(CLASSIC)).toBe('Classic Inning');
    expect(getDailyModeName(V2)).toBe('Daily Nine');
  });

  it('advances runners, forces walks and scores runs rather than points', () => {
    const loaded = play(['BB', 'BB', 'BB']);
    expect(loaded.inning.bases).toEqual({ first: true, second: true, third: true });
    expect(loaded.score.runs).toBe(0);
    const result = play(['BB', 'BB', 'BB', 'BB', 'HR']);
    expect(result.score).toMatchObject({ runs: 5, hits: 1, outs: 0, completed: false });
    expect(result.inning.bases).toEqual(DEFAULT_DAILY_BASE_STATE);
    expect(result.points).toMatchObject({ points: 0, maximumPoints: 0, atBatsCompleted: 5 });
    expect(play(['1B', '2B', '3B']).score).toMatchObject({ runs: 2, hits: 3 });
  });

  it('stops at the third out and ignores later outcomes', () => {
    const result = play(['HR', 'K', 'K', 'K']);
    expect(result.score).toEqual({ runs: 1, hits: 1, outs: 3, strikeouts: 3, completed: true });
    expect(result.points.atBatsCompleted).toBe(4);
    expect(play(['HR', 'K', 'K', 'K', 'HR'])).toEqual(result);
  });

  it('ends after nine with fewer than three outs', () => {
    const result = play(Array<DailyOutcome>(9).fill('HR'));
    expect(result.score).toMatchObject({ runs: 9, hits: 9, outs: 0, completed: true });
    expect(result.points).toMatchObject({ atBatsCompleted: 9, completed: true });
  });

  it('keeps both points policies playing after three Ks and preserves legacy behavior', () => {
    for (const ruleset of [V1, V2]) {
      expect(play(['K', 'K', 'K'], ruleset).points.completed).toBe(false);
      expect(play(['K', 'K', 'K', 'HR'], ruleset).points.points).toBe(ruleset === V1 ? 5 : 4);
      expect(play(Array<DailyOutcome>(9).fill('HR'), ruleset).points.points).toBe(ruleset === V1 ? 45 : 36);
    }
    expect(play(['HR', 'K', 'K', 'K'], LEGACY)).toEqual(play(['HR', 'K', 'K', 'K']));
  });

  it('shares the completion boundary across every supported policy', () => {
    for (const version of [CLASSIC, LEGACY, V1, V2]) {
      expect(isDailyGameComplete(version, 2, 9, 2)).toBe(false);
      expect(isDailyGameComplete(version, 3, 9, 3)).toBe(version === CLASSIC || version === LEGACY);
      expect(isDailyGameComplete(version, 9, 9, 0)).toBe(true);
    }
  });

  it('labels Classic sharing with runs and includes only the faced rows', () => {
    const state = play(['HR', 'K', 'K', 'K']);
    const text = formatDailyShareText({ rulesetVersion: CLASSIC, puzzleNumber: 42,
      summary: state.score, points: state.points, url: 'https://example.com/classic',
      pitchLines: [{ initials: 'AB', outcome: 'HR' }, { initials: 'MP', outcome: 'K' }] });
    expect(text).toContain('Classic Inning #42');
    expect(text).toContain('1 R / 1 H / 3 OUT');
    expect(text).not.toContain('PTS');
    expect(text).not.toContain('Andy Benes');
    expect(text).toContain('AB: HR\nMP: K');
  });
});
