import { describe, expect, it } from 'vitest';
import { resolve } from './resolve';
import { generateSingleElimination } from './formats/singleElimination';
import type { Player, Tournament } from './types';

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function makeTournament(n: number, thirdPlaceMatch = false): Tournament {
  const roster = players(n);
  return {
    id: 't',
    name: 'Test',
    status: 'RUNNING',
    config: {
      groupStage: null,
      knockout: { type: 'SINGLE_ELIM', thirdPlaceMatch },
      seeding: 'MANUAL',
      scoreMode: 'WIN_LOSS',
    },
    players: roster,
    groups: [],
    matches: generateSingleElimination(roster, { thirdPlaceMatch }),
    results: {},
    createdAt: '',
    updatedAt: '',
  };
}

/** Record the winner of a currently-ready match, returning a new tournament. */
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

describe('resolve — progression', () => {
  it('unlocks the next round only as feeders complete', () => {
    let t = makeTournament(4); // semis: W-0-0, W-0-1; final: W-1-0
    let d = resolve(t);
    expect(d.playableMatchIds.sort()).toEqual(['W-0-0', 'W-0-1']);
    expect(d.byId['W-1-0'].status).toBe('PENDING');

    t = record(t, 'W-0-0', 'A');
    d = resolve(t);
    // Final still pending — waiting on the other semi.
    expect(d.byId['W-1-0'].status).toBe('PENDING');

    t = record(t, 'W-0-1', 'A');
    d = resolve(t);
    expect(d.byId['W-1-0'].status).toBe('READY');
    expect(d.champion).toBeUndefined();

    t = record(t, 'W-1-0', 'A');
    d = resolve(t);
    expect(d.byId['W-1-0'].status).toBe('DONE');
    expect(d.isComplete).toBe(true);
    expect(d.champion).toBeDefined();
    expect(d.runnerUp).toBeDefined();
    expect(d.champion).not.toBe(d.runnerUp);
  });

  it('crowns the top seed when they win out (4 players)', () => {
    let t = makeTournament(4);
    t = record(t, 'W-0-0', 'A'); // p1 (seed 1) beats p4
    t = record(t, 'W-0-1', 'A'); // p2 (seed 2) beats p3
    t = record(t, 'W-1-0', 'A'); // p1 beats p2
    const d = resolve(t);
    expect(d.champion).toBe('p1');
    expect(d.runnerUp).toBe('p2');
  });
});

describe('resolve — byes', () => {
  it('auto-advances the real player past a bye', () => {
    // 3 players → seedOrder(4) = [1,4,2,3]: W-0-0 = p1 vs BYE, W-0-1 = p2 vs p3.
    const t = makeTournament(3);
    const d = resolve(t);
    expect(d.byId['W-0-0'].status).toBe('DONE');
    expect(d.byId['W-0-0'].isWalkover).toBe(true);
    expect(d.byId['W-0-0'].winnerId).toBe('p1');
    // The final has p1 on one side and TBD on the other.
    expect(d.byId['W-1-0'].status).toBe('PENDING');
    const final = d.byId['W-1-0'];
    const sides = [final.sideA, final.sideB];
    expect(sides.some((s) => s.kind === 'PLAYER' && s.playerId === 'p1')).toBe(true);
    expect(sides.some((s) => s.kind === 'TBD')).toBe(true);
    // Only the real match is playable.
    expect(d.playableMatchIds).toEqual(['W-0-1']);
  });
});

describe('resolve — third place', () => {
  it('fills the third-place match from the semi-final losers', () => {
    let t = makeTournament(4, true);
    t = record(t, 'W-0-0', 'A'); // p1 beats p4 → p4 to third place
    t = record(t, 'W-0-1', 'A'); // p2 beats p3 → p3 to third place
    let d = resolve(t);
    expect(d.byId['TP'].status).toBe('READY');
    const tp = d.byId['TP'];
    const tpIds = [tp.sideA, tp.sideB].map((s) =>
      s.kind === 'PLAYER' ? s.playerId : s.kind,
    );
    expect(tpIds.sort()).toEqual(['p3', 'p4']);

    t = record(t, 'TP', 'A');
    d = resolve(t);
    expect(d.thirdPlace).toBeDefined();
    expect(d.fourthPlace).toBeDefined();
  });
});

describe('resolve — stale result invalidation (cascade)', () => {
  it('invalidates a downstream result when an upstream winner changes', () => {
    let t = makeTournament(4);
    t = record(t, 'W-0-0', 'A'); // p1 advances
    t = record(t, 'W-0-1', 'A'); // p2 advances
    t = record(t, 'W-1-0', 'A'); // p1 champion
    expect(resolve(t).champion).toBe('p1');

    // Re-decide the first semi: now p4 advances instead of p1.
    t = record(t, 'W-0-0', 'B');
    const d = resolve(t);
    // The final's stored result referenced p1, who is no longer present.
    expect(d.byId['W-1-0'].status).toBe('READY');
    expect(d.champion).toBeUndefined();
    // The final now has p4 (not p1) facing p2.
    const final = d.byId['W-1-0'];
    const ids = [final.sideA, final.sideB]
      .map((s) => (s.kind === 'PLAYER' ? s.playerId : s.kind))
      .sort();
    expect(ids).toEqual(['p2', 'p4']);
  });
});
