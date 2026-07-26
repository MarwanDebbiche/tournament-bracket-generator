import { describe, expect, it } from 'vitest';
import { resolve } from './resolve';
import { buildSingleEliminationFromEntrants } from './formats/singleElimination';
import { swissSeedSlots } from './formats/swiss';
import type { Config, Match, Player, Tournament } from './types';

const POINTS = { win: 3, draw: 1, loss: 0 };

function roster(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
}

function swissConfig(overrides: Partial<Config> = {}): Config {
  return {
    groupStage: null,
    swiss: { rounds: 3, advance: 4, points: POINTS },
    knockout: { type: 'NONE' },
    seeding: 'MANUAL',
    scoreMode: 'WIN_LOSS',
    ...overrides,
  };
}

function tournament(players: Player[], config: Config, matches: Match[] = []): Tournament {
  return {
    id: 't',
    name: 'T',
    status: 'RUNNING',
    config,
    players,
    groups: [],
    matches,
    results: {},
    createdAt: '',
    updatedAt: '',
  };
}

/** Play every ready match with the higher-ranked side (A) winning until done. */
function driveToCompletion(t: Tournament) {
  let guard = 0;
  while (guard++ < 500) {
    const derived = resolve(t);
    if (derived.isComplete) return derived;
    const ready = derived.matches.filter(
      (m) => m.status === 'READY' && m.sideA.kind === 'PLAYER' && m.sideB.kind === 'PLAYER',
    );
    if (ready.length === 0) return derived;
    for (const m of ready) {
      const a = m.sideA as { playerId: string };
      const b = m.sideB as { playerId: string };
      t.results[m.id] = {
        sideAPlayerId: a.playerId,
        sideBPlayerId: b.playerId,
        scoreA: null,
        scoreB: null,
        winnerId: a.playerId,
      };
    }
  }
  return resolve(t);
}

describe('resolve — Swiss only (no knockout)', () => {
  it('crowns the standings leader once every round is played', () => {
    const t = tournament(roster(8), swissConfig());
    const derived = driveToCompletion(t);

    expect(derived.swissComplete).toBe(true);
    expect(derived.isComplete).toBe(true);
    expect(derived.champion).toBe(derived.swissStandings[0].playerId);
    expect(derived.champion).toBe('p1'); // top seed wins out
    expect(derived.runnerUp).toBe(derived.swissStandings[1].playerId);
  });

  it('exposes each generated round as playable and withholds the next', () => {
    const t = tournament(roster(8), swissConfig());
    const derived = resolve(t);
    // Only round 0 exists up front: 4 ready matches, no round-1 matches yet.
    expect(derived.matches.filter((m) => m.status === 'READY')).toHaveLength(4);
    expect(derived.matches.every((m) => m.match.round === 0)).toBe(true);
    expect(derived.champion).toBeUndefined();
  });
});

describe('resolve — Swiss into a single-elimination knockout', () => {
  it('holds the knockout until the Swiss stage finishes, then seeds it', () => {
    const config = swissConfig({ knockout: { type: 'SINGLE_ELIM' } });
    const knockout = buildSingleEliminationFromEntrants(swissSeedSlots(4));
    const t = tournament(roster(8), config, knockout);

    // Before any Swiss result, knockout entrants are unknown.
    const initial = resolve(t);
    expect(initial.qualifierSeeding).toBeUndefined();
    const firstKnockout = initial.matches.find((m) => m.match.phase === 'WINNERS');
    expect(firstKnockout?.status).toBe('PENDING');

    const derived = driveToCompletion(t);
    expect(derived.swissComplete).toBe(true);
    expect(derived.qualifierSeeding).toEqual(
      derived.swissStandings.slice(0, 4).map((r) => r.playerId),
    );
    expect(derived.isComplete).toBe(true);
    // The Swiss leader is the top knockout seed and wins the bracket.
    expect(derived.champion).toBe('p1');
  });
});
