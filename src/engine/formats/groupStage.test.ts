import { describe, expect, it } from 'vitest';
import {
  distributeIntoGroups,
  generateGroupStage,
  groupRankEntrants,
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

describe('groupRankEntrants + cross seeding', () => {
  it('orders entrants rank-major (all winners, then all runners-up)', () => {
    const { groups } = generateGroupStage(players(8), 2);
    const entrants = groupRankEntrants(groups, 2) as Array<
      Extract<Slot, { kind: 'GROUP_RANK' }>
    >;
    expect(entrants.map((e) => e.rank)).toEqual([1, 1, 2, 2]);
  });

  it('pairs each group winner against a different group in round one', () => {
    const { groups } = generateGroupStage(players(8), 2);
    const entrants = groupRankEntrants(groups, 2);
    const bracket = buildSingleEliminationFromEntrants(entrants);
    const firstRound = bracket.filter((m) => m.round === 0);

    for (const match of firstRound) {
      const a = match.slotA;
      const b = match.slotB;
      expect(a.kind).toBe('GROUP_RANK');
      expect(b.kind).toBe('GROUP_RANK');
      if (a.kind === 'GROUP_RANK' && b.kind === 'GROUP_RANK') {
        // Different groups, and a winner (rank 1) faces a runner-up (rank 2).
        expect(a.groupId).not.toBe(b.groupId);
        expect([a.rank, b.rank].sort()).toEqual([1, 2]);
      }
    }
  });
});
