import { describe, expect, it } from 'vitest';
import {
  distributeIntoGroups,
  generateGroupStage,
  knockoutSeedSlots,
} from './groupStage';
import { buildSingleEliminationFromEntrants } from './singleElimination';
import type { Player, Slot } from '../types';

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

describe('distributeIntoGroups', () => {
  it('spreads players into balanced groups and keeps everyone', () => {
    const groups = distributeIntoGroups(players(10), 3);
    expect(groups).toHaveLength(3);
    const sizes = groups.map((g) => g.length).sort();
    expect(sizes).toEqual([3, 3, 4]);
    const all = groups.flat().map((p) => p.id);
    expect(new Set(all).size).toBe(10);
  });
});

describe('generateGroupStage', () => {
  it('creates the groups and a full round-robin per group', () => {
    const { groups, matches } = generateGroupStage(players(8), 2);
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const groupMatches = matches.filter((m) => m.groupId === group.id);
      const size = group.playerIds.length;
      expect(groupMatches).toHaveLength((size * (size - 1)) / 2);
      expect(groupMatches.every((m) => m.phase === 'GROUP')).toBe(true);
    }
  });
});

describe('knockoutSeedSlots', () => {
  it('produces one SEED slot per qualifier, in seed order', () => {
    const { groups } = generateGroupStage(players(8), 2); // 2 groups × 2 = 4
    const entrants = knockoutSeedSlots(groups, 2) as Array<
      Extract<Slot, { kind: 'SEED' }>
    >;
    expect(entrants.every((e) => e.kind === 'SEED')).toBe(true);
    expect(entrants.map((e) => e.seed)).toEqual([1, 2, 3, 4]);
  });

  it('assigns byes to the top seeds when the field is not a power of two', () => {
    // 3 groups × 2 = 6 qualifiers → 8-slot bracket → byes on seeds 1 and 2.
    const { groups } = generateGroupStage(players(12), 3);
    const bracket = buildSingleEliminationFromEntrants(knockoutSeedSlots(groups, 2));
    const byeSeeds = bracket
      .filter((m) => m.round === 0)
      .filter((m) => m.slotA.kind === 'BYE' || m.slotB.kind === 'BYE')
      .flatMap((m) => [m.slotA, m.slotB])
      .filter((s): s is Extract<Slot, { kind: 'SEED' }> => s.kind === 'SEED')
      .map((s) => s.seed)
      .sort((a, b) => a - b);
    expect(byeSeeds).toEqual([1, 2]);
  });
});
