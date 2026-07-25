import { describe, expect, it } from 'vitest';
import { resolve } from './resolve';
import type { ResolvedSide } from './resolve';
import { generateGroupStage, groupRankEntrants } from './formats/groupStage';
import { buildSingleEliminationFromEntrants } from './formats/singleElimination';
import type { Player, Tournament } from './types';

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function groupTournament(
  roster: Player[],
  numGroups: number,
  advance: number,
): Tournament {
  const { groups, matches: groupMatches } = generateGroupStage(roster, numGroups);
  const entrants = groupRankEntrants(groups, advance);
  const knockout = buildSingleEliminationFromEntrants(entrants, {});
  return {
    id: 't',
    name: 'T',
    status: 'RUNNING',
    config: {
      groupStage: {
        numGroups,
        advancePerGroup: advance,
        points: { win: 3, draw: 1, loss: 0 },
        tiebreakers: ['HEAD_TO_HEAD', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'WINS', 'MANUAL'],
      },
      knockout: { type: 'SINGLE_ELIM' },
      seeding: 'MANUAL',
      scoreMode: 'WIN_LOSS',
    },
    players: roster,
    groups,
    matches: [...groupMatches, ...knockout],
    results: {},
    createdAt: '',
    updatedAt: '',
  };
}

function record(t: Tournament, matchId: string, winner: 'A' | 'B'): Tournament {
  const rm = resolve(t).byId[matchId];
  if (rm.sideA.kind !== 'PLAYER' || rm.sideB.kind !== 'PLAYER') {
    throw new Error(`Match ${matchId} is not ready`);
  }
  const winnerId = winner === 'A' ? rm.sideA.playerId : rm.sideB.playerId;
  return {
    ...t,
    results: {
      ...t.results,
      [matchId]: {
        sideAPlayerId: rm.sideA.playerId,
        sideBPlayerId: rm.sideB.playerId,
        scoreA: null,
        scoreB: null,
        winnerId,
      },
    },
  };
}

function playerId(side: ResolvedSide): string | undefined {
  return side.kind === 'PLAYER' ? side.playerId : undefined;
}

describe('resolve — group stage → knockout', () => {
  // Serpentine distribution of [p1..p4] into 2 groups: G0=[p1,p4], G1=[p2,p3].
  it('keeps the knockout on hold until every group is complete', () => {
    let t = groupTournament(players(4), 2, 1);
    expect(resolve(t).byId['W-0-0'].status).toBe('PENDING');
    expect(resolve(t).groupsComplete).toEqual({ G0: false, G1: false });

    // Complete only group 0.
    t = record(t, 'G0-R0-M0', 'A'); // p1 beats p4
    const partial = resolve(t);
    expect(partial.groupsComplete).toEqual({ G0: true, G1: false });
    expect(partial.byId['W-0-0'].status).toBe('PENDING');
  });

  it('feeds group winners into the bracket once groups finish', () => {
    let t = groupTournament(players(4), 2, 1);
    t = record(t, 'G0-R0-M0', 'A'); // p1 wins group 0
    t = record(t, 'G1-R0-M0', 'A'); // p2 wins group 1
    const d = resolve(t);

    expect(d.standings['G0'][0].playerId).toBe('p1');
    expect(d.standings['G1'][0].playerId).toBe('p2');

    const final = d.byId['W-0-0'];
    expect(final.status).toBe('READY');
    expect(playerId(final.sideA)).toBe('p1');
    expect(playerId(final.sideB)).toBe('p2');
  });
});
