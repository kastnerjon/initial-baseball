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
  lead?: string;
  scoringRows?: { when: string; result: string; points: string }[];
  strikes?: { heading: string; rules: string[] };
  footerLabel?: string;
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
      intro: 'Guess 9 baseball players using their initials and up to 4 hints.',
      lead: 'The fewer hints you use, the more points you score.',
      steps: [],
      scoringRows: [
        { when: 'No hints', result: 'Home Run (HR)', points: '4' },
        { when: 'After 1 hint', result: 'Triple (3B)', points: '3' },
        { when: 'After 2 hints', result: 'Double (2B)', points: '2' },
        { when: 'After 3 hints', result: 'Single (1B)', points: '1' },
        { when: 'After 4 hints', result: 'Walk (BB)', points: '0.5' },
      ],
      strikes: {
        heading: 'What happens if you strike out?',
        rules: [
          'Each incorrect guess counts as a strike.',
          "Your first 2 strikes don't reduce your points.",
          'Strike 3 ends the at-bat with 0 points.',
          'You can give up at any time for 0 points.',
        ],
      },
      footerLabel: 'Your goal:',
      footer: 'Score as many points as possible across 9 at-bats. A perfect game is 36 points!',
    };
  }

  return assertNeverRuleset(rulesetVersion);
}

function assertNeverRuleset(value: never): never {
  throw new Error(`Unsupported How to play ruleset: ${String(value)}`);
}
