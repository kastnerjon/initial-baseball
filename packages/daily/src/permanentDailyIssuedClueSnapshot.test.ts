import { describe, expect, it } from 'vitest';
import type { HintType } from '@initial-baseball/shared';
import {
  PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION,
  clonePermanentDailyIssuedClueSnapshot,
  createPermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';

type MutableHintLayoutSlot = {
  slot: 1 | 2 | 3 | 4;
  hintType: HintType;
  displayLabel: string;
};

type MutablePitch = {
  pitchNumber: number;
  canonicalPlayerId: string;
  initials: string;
  hintValues: string[];
};

type MutableInput = {
  hintLayout: MutableHintLayoutSlot[];
  pitches: MutablePitch[];
};

describe('Permanent Daily issued clue snapshot', () => {
  it('freezes exact ordered public initials and hint presentation without scoring fields', () => {
    const snapshot = createPermanentDailyIssuedClueSnapshot(buildInput());

    expect(snapshot.schemaVersion).toBe(
      PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION,
    );
    expect(snapshot.hintLayout).toEqual([
      { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
      { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
      { slot: 3, hintType: 'position', displayLabel: 'Position' },
      { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
    ]);
    expect(snapshot.pitches).toHaveLength(9);
    expect(snapshot.pitches[0]).toEqual({
      pitchNumber: 1,
      canonicalPlayerId: 'player-1',
      initials: 'P1',
      hintValues: [
        '2000s',
        'SEA, CIN',
        'CF',
        'HR 300 / RBI 900 / SB 50 / BA .280 / OBP .350',
      ],
    });
    expect(snapshot).not.toHaveProperty('rulesetVersion');
    expect(snapshot.hintLayout[0]).not.toHaveProperty('result');
    expect(snapshot.pitches[0]).not.toHaveProperty('outcome');
    expect(snapshot.pitches[0]).not.toHaveProperty('points');
  });

  it('preserves public clue values exactly, including sourced zero saves', () => {
    const input = buildInput();
    input.pitches[8]!.hintValues[3] =
      'W 100 / L 80 / SV 0 / ERA 3.50 / WHIP 1.20 / K 1500';

    const snapshot = createPermanentDailyIssuedClueSnapshot(input);

    expect(snapshot.pitches[8]?.hintValues[3]).toContain('SV 0');
  });

  it('rejects invalid hint layouts', () => {
    const missingSlot = buildInput();
    missingSlot.hintLayout.pop();
    expect(() => createPermanentDailyIssuedClueSnapshot(missingSlot)).toThrow(
      'exactly 4 hint-layout slots',
    );

    const wrongOrder = buildInput();
    wrongOrder.hintLayout[1]!.slot = 3;
    expect(() => createPermanentDailyIssuedClueSnapshot(wrongOrder)).toThrow(
      'requires hint slots 1 through 4',
    );

    const duplicateType = buildInput();
    duplicateType.hintLayout[1]!.hintType = 'main_decade';
    expect(() => createPermanentDailyIssuedClueSnapshot(duplicateType)).toThrow(
      'repeats hint type',
    );

    const blankLabel = buildInput();
    blankLabel.hintLayout[0]!.displayLabel = '   ';
    expect(() => createPermanentDailyIssuedClueSnapshot(blankLabel)).toThrow(
      'hint 1 display label is required',
    );
  });

  it('rejects non-nine, out-of-order, duplicate-player, or incomplete pitch clues', () => {
    const short = buildInput();
    short.pitches.pop();
    expect(() => createPermanentDailyIssuedClueSnapshot(short)).toThrow(
      'exactly 9 pitches',
    );

    const outOfOrder = buildInput();
    outOfOrder.pitches[1]!.pitchNumber = 3;
    expect(() => createPermanentDailyIssuedClueSnapshot(outOfOrder)).toThrow(
      'exact pitch order 1 through 9',
    );

    const duplicate = buildInput();
    duplicate.pitches[1]!.canonicalPlayerId = 'player-1';
    expect(() => createPermanentDailyIssuedClueSnapshot(duplicate)).toThrow(
      'Duplicate permanent Daily clue snapshot player',
    );

    const missingValue = buildInput();
    missingValue.pitches[0]!.hintValues.pop();
    expect(() => createPermanentDailyIssuedClueSnapshot(missingValue)).toThrow(
      'exactly 4 hint values',
    );

    const blankValue = buildInput();
    blankValue.pitches[0]!.hintValues[0] = '   ';
    expect(() => createPermanentDailyIssuedClueSnapshot(blankValue)).toThrow(
      'pitch 1 hint 1 value is required',
    );
  });

  it('defensively copies source and clone data', () => {
    const input = buildInput();
    const snapshot = createPermanentDailyIssuedClueSnapshot(input);

    input.hintLayout[0]!.displayLabel = 'Changed';
    input.pitches[0]!.initials = 'ZZ';
    input.pitches[0]!.hintValues[0] = 'changed';

    expect(snapshot.hintLayout[0]?.displayLabel).toBe('Main decade played in');
    expect(snapshot.pitches[0]?.initials).toBe('P1');
    expect(snapshot.pitches[0]?.hintValues[0]).toBe('2000s');

    const clone = clonePermanentDailyIssuedClueSnapshot(snapshot);
    expect(clone).toEqual(snapshot);
    expect(clone).not.toBe(snapshot);
    expect(clone.hintLayout).not.toBe(snapshot.hintLayout);
    expect(clone.pitches).not.toBe(snapshot.pitches);
    expect(clone.pitches[0]?.hintValues).not.toBe(snapshot.pitches[0]?.hintValues);
  });
});

function buildInput(): MutableInput {
  return {
    hintLayout: [
      { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
      { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
      { slot: 3, hintType: 'position', displayLabel: 'Position' },
      { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
    ],
    pitches: Array.from({ length: 9 }, (_, index) => ({
      pitchNumber: index + 1,
      canonicalPlayerId: `player-${index + 1}`,
      initials: `P${index + 1}`,
      hintValues: [
        '2000s',
        'SEA, CIN',
        index === 8 ? 'P' : 'CF',
        index === 8
          ? 'W 100 / L 80 / SV 10 / ERA 3.50 / WHIP 1.20 / K 1500'
          : 'HR 300 / RBI 900 / SB 50 / BA .280 / OBP .350',
      ],
    })),
  };
}
