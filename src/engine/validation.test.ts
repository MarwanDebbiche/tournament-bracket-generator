import { describe, expect, it } from 'vitest';
import { nextPowerOfTwo, validateSetup } from './validation';
import type { Config, Player } from './types';

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i + 1}`,
  }));
}

function config(overrides: Partial<Config> = {}): Config {
  return {
    groupStage: null,
    swiss: null,
    knockout: { type: 'SINGLE_ELIM' },
    seeding: 'RANDOM',
    scoreMode: 'WIN_LOSS',
    ...overrides,
  };
}

describe('nextPowerOfTwo', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [5, 8],
    [8, 8],
    [9, 16],
    [16, 16],
    [17, 32],
  ])('nextPowerOfTwo(%i) = %i', (input, expected) => {
    expect(nextPowerOfTwo(input)).toBe(expected);
  });

  it('returns 0 for counts below 1', () => {
    expect(nextPowerOfTwo(0)).toBe(0);
  });
});

describe('validateSetup — single elimination', () => {
  it('accepts any count >= 2 and computes byes', () => {
    const result = validateSetup(players(5), config());
    expect(result.ok).toBe(true);
    expect(result.knockout).toEqual({ entrants: 5, bracketSize: 8, byes: 3 });
  });

  it('needs no byes for a power-of-two field', () => {
    const result = validateSetup(players(8), config());
    expect(result.ok).toBe(true);
    expect(result.knockout.byes).toBe(0);
  });

  it('rejects fewer than 2 players', () => {
    const result = validateSetup(players(1), config());
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/at least 2 players/i);
  });
});

describe('validateSetup — double elimination', () => {
  it('warns that 2 entrants collapse to a single final', () => {
    const result = validateSetup(
      players(2),
      config({ knockout: { type: 'DOUBLE_ELIM' } }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/single final/i);
  });
});

describe('validateSetup — player names', () => {
  it('errors on empty names', () => {
    const list = players(4);
    list[0].name = '   ';
    const result = validateSetup(list, config());
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/no name/i);
  });

  it('warns on duplicate names but stays valid', () => {
    const list = players(4);
    list[1].name = 'Player 1';
    const result = validateSetup(list, config());
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/duplicate/i);
  });
});

describe('validateSetup — group stage', () => {
  const groupConfig = (numGroups: number, advancePerGroup: number): Config =>
    config({
      groupStage: {
        numGroups,
        advancePerGroup,
        points: { win: 3, draw: 1, loss: 0 },
        tiebreakers: [],
      },
    });

  it('accepts a valid groups → knockout setup', () => {
    const result = validateSetup(players(8), groupConfig(2, 2));
    expect(result.ok).toBe(true);
    // 2 groups × 2 advancing = 4 entrants → 4-slot bracket, no byes.
    expect(result.knockout).toEqual({ entrants: 4, bracketSize: 4, byes: 0 });
  });

  it('rejects groups that would hold fewer than 2 players', () => {
    const result = validateSetup(players(3), groupConfig(2, 1));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/need at least/i);
  });

  it('rejects advancing more players than a group holds', () => {
    const result = validateSetup(players(8), groupConfig(2, 5));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/can't advance/i);
  });

  it('pads qualifiers to a power of two with byes', () => {
    // 3 groups × 2 = 6 entrants → 8-slot bracket, 2 byes.
    const result = validateSetup(players(9), groupConfig(3, 2));
    expect(result.ok).toBe(true);
    expect(result.knockout).toEqual({ entrants: 6, bracketSize: 8, byes: 2 });
  });
});

describe('validateSetup — seeding', () => {
  it('rejects group-standing seeding without a group stage', () => {
    const result = validateSetup(players(8), config({ seeding: 'GROUP_STANDING' }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/group-standing seeding/i);
  });
});

describe('validateSetup — total matches to play', () => {
  const matches = (n: number, overrides: Partial<Config> = {}) =>
    validateSetup(players(n), config(overrides)).totalMatches;

  it('single elimination is entrants − 1, independent of byes', () => {
    expect(matches(8)).toBe(7);
    expect(matches(6)).toBe(5); // 8-slot bracket, 2 byes, but only 5 real games
    expect(matches(2)).toBe(1);
  });

  it('counts a third-place match only when it is a real contest', () => {
    const withThird: Partial<Config> = {
      knockout: { type: 'SINGLE_ELIM', thirdPlaceMatch: true },
    };
    expect(matches(8, withThird)).toBe(8); // 7 + real third place
    expect(matches(4, withThird)).toBe(4); // 3 + real third place
    expect(matches(3, withThird)).toBe(2); // third place would be a walkover → not counted
  });

  it('double elimination is 2·entrants − 2 (reset excluded)', () => {
    expect(matches(4, { knockout: { type: 'DOUBLE_ELIM' } })).toBe(6);
    expect(matches(6, { knockout: { type: 'DOUBLE_ELIM' } })).toBe(10);
  });

  it('adds group round-robin games to the knockout games', () => {
    // 2 groups of 3 → 2×3 = 6 group games; 2×2 = 4 qualifiers → 3 knockout games.
    const result = validateSetup(players(6), {
      groupStage: {
        numGroups: 2,
        advancePerGroup: 2,
        points: { win: 3, draw: 1, loss: 0 },
        tiebreakers: [],
      },
      swiss: null,
      knockout: { type: 'SINGLE_ELIM' },
      seeding: 'RANDOM',
      scoreMode: 'WIN_LOSS',
    });
    expect(result.totalMatches).toBe(9);
  });
});

describe('validateSetup — sequential steps (rounds)', () => {
  const steps = (n: number, overrides: Partial<Config> = {}) =>
    validateSetup(players(n), config(overrides)).sequentialSteps;

  const groups = (n: number, numGroups: number, advancePerGroup: number, extra: Partial<Config> = {}) =>
    validateSetup(players(n), {
      groupStage: {
        numGroups,
        advancePerGroup,
        points: { win: 3, draw: 1, loss: 0 },
        tiebreakers: [],
      },
      swiss: null,
      knockout: { type: 'SINGLE_ELIM' },
      seeding: 'RANDOM',
      scoreMode: 'WIN_LOSS',
      ...extra,
    }).sequentialSteps;

  it('single elimination is log2(bracket size)', () => {
    expect(steps(16)).toBe(4); // 15 matches, but 4 rounds
    expect(steps(8)).toBe(3);
    expect(steps(6)).toBe(3); // 8-slot bracket
    expect(steps(2)).toBe(1);
  });

  it('a third-place match does not add a round (plays alongside the final)', () => {
    expect(steps(8, { knockout: { type: 'SINGLE_ELIM', thirdPlaceMatch: true } })).toBe(3);
  });

  it('double elimination is 2·log2(bracket size), +1 with a reset', () => {
    expect(steps(4, { knockout: { type: 'DOUBLE_ELIM' } })).toBe(4);
    expect(steps(8, { knockout: { type: 'DOUBLE_ELIM' } })).toBe(6);
    expect(steps(8, { knockout: { type: 'DOUBLE_ELIM', grandFinalReset: true } })).toBe(7);
  });

  it('a group round-robin needs size−1 rounds (even) and runs in parallel across groups', () => {
    // 4 groups of 4 → 3 group rounds; 4×2 = 8 qualifiers → 3 knockout rounds → 6.
    expect(groups(16, 4, 2)).toBe(6);
    // 2 groups of 3 (odd → 3 rounds) → 4 qualifiers → 2 knockout rounds → 5.
    expect(groups(6, 2, 2)).toBe(5);
  });
});

describe('validateSetup — Swiss stage', () => {
  const P = { win: 3, draw: 1, loss: 0 };
  const swissOnly = (rounds: number) =>
    config({ swiss: { rounds, advance: 0, points: P }, knockout: { type: 'NONE' } });
  const swissKnockout = (rounds: number, advance: number) =>
    config({ swiss: { rounds, advance, points: P }, knockout: { type: 'SINGLE_ELIM' } });

  it('accepts a standalone Swiss system', () => {
    expect(validateSetup(players(8), swissOnly(4)).ok).toBe(true);
  });

  it('accepts a Swiss stage feeding a knockout', () => {
    expect(validateSetup(players(8), swissKnockout(3, 4)).ok).toBe(true);
  });

  it('rejects a knockout-free setup that has no Swiss stage', () => {
    const result = validateSetup(players(8), config({ knockout: { type: 'NONE' } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('knockout format'))).toBe(true);
  });

  it('rejects choosing both a group stage and a Swiss stage', () => {
    const result = validateSetup(
      players(8),
      config({
        groupStage: { numGroups: 2, advancePerGroup: 2, points: P, tiebreakers: [] },
        swiss: { rounds: 3, advance: 4, points: P },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('either a group stage or a Swiss'))).toBe(true);
  });

  it('caps the number of rounds at players − 1', () => {
    const result = validateSetup(players(4), swissOnly(5));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('at most 3 Swiss rounds'))).toBe(true);
  });

  it('requires at least one round', () => {
    expect(validateSetup(players(4), swissOnly(0)).ok).toBe(false);
  });

  it('rejects advancing more players than exist', () => {
    const result = validateSetup(players(6), swissKnockout(3, 8));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Can't advance 8"))).toBe(true);
  });

  it('rejects advancing fewer than two players', () => {
    expect(validateSetup(players(6), swissKnockout(3, 1)).ok).toBe(false);
  });

  it('counts Swiss games (⌊n/2⌋ per round) plus any knockout games', () => {
    expect(validateSetup(players(8), swissOnly(3)).totalMatches).toBe(12);
    expect(validateSetup(players(8), swissKnockout(3, 4)).totalMatches).toBe(12 + 3);
    // Odd field: 5 players → 2 games per round.
    expect(validateSetup(players(5), swissOnly(4)).totalMatches).toBe(8);
  });

  it('counts one sequential step per Swiss round, plus knockout rounds', () => {
    expect(validateSetup(players(8), swissOnly(3)).sequentialSteps).toBe(3);
    expect(validateSetup(players(8), swissKnockout(3, 4)).sequentialSteps).toBe(3 + 2);
  });
});
