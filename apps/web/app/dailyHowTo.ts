import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';

export type DailyHowToRulesetVersion =
  | typeof CLASSIC_DAILY_RULESET_VERSION
  | typeof POINTS_V3_DAILY_RULESET_VERSION
  | typeof POINTS_V4_DAILY_RULESET_VERSION;

export type DailyHowToContent = {
  title: string;
  intro: string;
  steps: string[];
  footer: string;
};

export function getDailyHowToContent(
  rulesetVersion: DailyHowToRulesetVersion,
): DailyHowToContent {
  if (rulesetVersion === CLASSIC_DAILY_RULESET_VERSION) {
    return {
      title: 'How to play Classic Inning',
      intro: 'Guess each player from their initials. Reveal hints when you need them.',
      steps: [
        'A third wrong guess—or Give Up—records an out.',
        'Hits and walks move runners using the baseball outcome you earned.',
        'The inning ends after 3 outs or after the ninth at-bat, whichever comes first.',
      ],
      footer: 'Try to score as many runs as you can before the inning ends.',
    };
  }

  if (rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION) {
    return {
      title: 'How to play Daily Nine',
      intro: 'Guess each player from their initials. Reveal up to four hints when you need them.',
      steps: [
        'Each at-bat starts at 7 points.',
        'Every revealed hint and every wrong guess costs 1 point.',
        'A third wrong guess—or Give Up—scores 0 points for that at-bat.',
        'Play all 9 at-bats for a maximum score of 63.',
      ],
      footer: 'Earlier correct guesses are worth more.',
    };
  }

  if (rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION) {
    return {
      title: 'How to play Daily Nine',
      intro: 'Guess each player from their initials. Reveal up to four hints when you need them.',
      steps: [
        'Correct on initials: 4 points. After hints 1–4: 3, 2, 1, then 0.5 points.',
        'Wrong guesses one and two do not reduce your score.',
        'A third wrong guess—or Give Up—is a strikeout and scores 0 points.',
        'Play all 9 at-bats for a maximum score of 36.',
      ],
      footer: 'Earlier correct guesses are worth more.',
    };
  }

  return assertNeverRuleset(rulesetVersion);
}

function assertNeverRuleset(value: never): never {
  throw new Error(`Unsupported How to play ruleset: ${String(value)}`);
}
