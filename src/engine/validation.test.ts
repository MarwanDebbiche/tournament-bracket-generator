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
