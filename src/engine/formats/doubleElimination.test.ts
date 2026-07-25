import { describe, expect, it } from 'vitest';
import { generateDoubleElimination } from './doubleElimination';
import { resolve } from '../resolve';
import type { Player, Tournament } from '../types';

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function deTournament(n: number, grandFinalReset = false): Tournament {
  const roster = players(n);
  return {
    id: 't',
    name: 'T',
    status: 'RUNNING',
    config: {
      groupStage: null,
      knockout: { type: 'DOUBLE_ELIM', grandFinalReset },
      seeding: 'MANUAL',
      scoreMode: 'WIN_LOSS',
    },
    players: roster,
    groups: [],
    matches: generateDoubleElimination(roster, { grandFinalReset }),
    results: {},
    createdAt: '',
    updatedAt: '',
  };
}

function record(t: Tournament, matchId: string, winner: 'A' | 'B'): Tournament {
  const rm = resolve(t).byId[matchId];
  if (rm.sideA.kind !== 'PLAYER' || rm.sideB.kind !== 'PLAYER') {
    throw new Error(`Match ${matchId} not ready`);
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

describe('generateDoubleElimination — structure', () => {
  it.each([
    [4, 6],
    [8, 14],
    [16, 30],
  ])('%i players → %i matches (2N-2)', (n, total) => {
    expect(generateDoubleElimination(players(n))).toHaveLength(total);
  });

  it('adds one match for the grand-final reset', () => {
    expect(generateDoubleElimination(players(8), { grandFinalReset: true })).toHaveLength(
      15,
    );
  });

  it('drops every winners match into the losers bracket and never the reverse', () => {
    const matches = generateDoubleElimination(players(8));
    for (const m of matches.filter((x) => x.phase === 'WINNERS')) {
      expect(m.loserTo).toBeDefined();
    }
    for (const m of matches.filter((x) => x.phase === 'LOSERS')) {
      expect(m.loserTo).toBeUndefined();
      expect(m.winnerTo).toBeDefined();
    }
  });

  it('keeps all feeder references valid', () => {
    const matches = generateDoubleElimination(players(8), { grandFinalReset: true });
    const ids = new Set(matches.map((m) => m.id));
    for (const m of matches) {
      for (const slot of [m.slotA, m.slotB]) {
        if (slot.kind === 'WINNER_OF' || slot.kind === 'LOSER_OF') {
          expect(ids.has(slot.matchId)).toBe(true);
        }
      }
    }
  });
});

describe('generateDoubleElimination — playthrough (4 players)', () => {
  // Play WB and LB down to the grand final; returns the tournament at GF time.
  function playToGrandFinal(t: Tournament): Tournament {
    t = record(t, 'W-0-0', 'A'); // p1 > p4
    t = record(t, 'W-0-1', 'A'); // p2 > p3
    t = record(t, 'W-1-0', 'A'); // p1 > p2 (p2 drops)
    t = record(t, 'L-0-0', 'A'); // p4 > p3
    t = record(t, 'L-1-0', 'B'); // p2 > p4 (p2 wins losers bracket)
    return t;
  }

  it('crowns the winners-bracket player who also wins the grand final', () => {
    let t = playToGrandFinal(deTournament(4));
    // GF: p1 (winners) vs p2 (losers).
    t = record(t, 'GF', 'A'); // p1 wins
    const d = resolve(t);
    expect(d.champion).toBe('p1');
    expect(d.runnerUp).toBe('p2');
    expect(d.isComplete).toBe(true);
  });

  it('skips the reset when the winners player wins the first grand final', () => {
    let t = playToGrandFinal(deTournament(4, true));
    t = record(t, 'GF', 'A'); // winners player p1 wins → no reset needed
    const d = resolve(t);
    expect(d.champion).toBe('p1');
    expect(d.byId['GF2'].skipped).toBe(true);
    expect(d.isComplete).toBe(true);
  });

  it('forces a reset when the losers player wins the first grand final', () => {
    let t = playToGrandFinal(deTournament(4, true));
    t = record(t, 'GF', 'B'); // losers player p2 wins GF1 → reset
    let d = resolve(t);
    expect(d.champion).toBeUndefined();
    expect(d.byId['GF2'].status).toBe('READY');
    expect(d.byId['GF2'].skipped).toBeFalsy();

    t = record(t, 'GF2', 'A'); // p2 wins the reset → champion
    d = resolve(t);
    expect(d.champion).toBe('p2');
    expect(d.runnerUp).toBe('p1');
    expect(d.isComplete).toBe(true);
  });
});
