import { describe, expect, it } from 'vitest';
import { resolve, seedQualifiers } from './resolve';
import type { ResolvedSide } from './resolve';
import { generateGroupStage, knockoutSeedSlots } from './formats/groupStage';
import { buildSingleEliminationFromEntrants } from './formats/singleElimination';
import type { StandingRow } from './standings';
import type { Group, Player, Tournament } from './types';

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
  const entrants = knockoutSeedSlots(groups, advance);
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

function standingRow(playerId: string, points: number, played = 3): StandingRow {
  return {
    playerId,
    played,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points,
  };
}

describe('seedQualifiers — merit seeding', () => {
  const groups: Group[] = [
    { id: 'G0', name: 'Group A', playerIds: ['a1', 'a2'] },
    { id: 'G1', name: 'Group B', playerIds: ['b1', 'b2'] },
    { id: 'G2', name: 'Group C', playerIds: ['c1', 'c2'] },
  ];

  it('seeds winners above runners-up, each band ordered by points', () => {
    const standings = {
      G0: [standingRow('a1', 9), standingRow('a2', 4)],
      G1: [standingRow('b1', 6), standingRow('b2', 5)],
      G2: [standingRow('c1', 7), standingRow('c2', 3)],
    };
    // Winners by points: a1(9), c1(7), b1(6); then runners-up: b2(5), a2(4), c2(3).
    // Note b2 (Group B runner-up, 5 pts) outranks a2 (Group A runner-up, 4 pts),
    // even though Group A comes first — the old group-order seeding ranked a2 higher.
    expect(seedQualifiers(groups, standings, 2)).toEqual([
      'a1', 'c1', 'b1', 'b2', 'a2', 'c2',
    ]);
  });

  it('normalizes by games played across uneven groups', () => {
    const uneven: Group[] = [
      { id: 'G0', name: 'A', playerIds: ['a'] },
      { id: 'G1', name: 'B', playerIds: ['b'] },
    ];
    const standings = {
      G0: [standingRow('a', 4, 2)], // 2.0 pts/game
      G1: [standingRow('b', 5, 3)], // 1.67 pts/game
    };
    expect(seedQualifiers(uneven, standings, 1)).toEqual(['a', 'b']);
  });
});
