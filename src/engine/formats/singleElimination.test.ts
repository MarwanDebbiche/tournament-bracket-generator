import { describe, expect, it } from 'vitest';
import { generateSingleElimination } from './singleElimination';
import { nextPowerOfTwo } from '../validation';
import type { Match, Player } from '../types';

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function countByes(matches: Match[]): number {
  return matches
    .filter((m) => m.round === 0)
    .reduce(
      (sum, m) =>
        sum + (m.slotA.kind === 'BYE' ? 1 : 0) + (m.slotB.kind === 'BYE' ? 1 : 0),
      0,
    );
}

describe('generateSingleElimination', () => {
  it('rejects fewer than 2 players', () => {
    expect(() => generateSingleElimination(players(1))).toThrow();
  });

  it.each([2, 3, 4, 5, 8, 16, 17])(
    'has size-1 winners matches and the right byes for %i players',
    (n) => {
      const matches = generateSingleElimination(players(n));
      const size = nextPowerOfTwo(n);
      const winners = matches.filter((m) => m.phase === 'WINNERS');
      expect(winners).toHaveLength(size - 1);
      expect(matches.filter((m) => m.round === 0)).toHaveLength(size / 2);
      expect(countByes(matches)).toBe(size - n);
    },
  );

  it('never pairs two byes together', () => {
    for (const n of [3, 5, 6, 7, 9, 11, 13, 15, 17]) {
      const matches = generateSingleElimination(players(n));
      for (const m of matches) {
        expect(m.slotA.kind === 'BYE' && m.slotB.kind === 'BYE').toBe(false);
      }
    }
  });

  it('wires every winners match except the final to a downstream match', () => {
    const matches = generateSingleElimination(players(8));
    const winners = matches.filter((m) => m.phase === 'WINNERS');
    const finals = winners.filter((m) => !m.winnerTo);
    expect(finals).toHaveLength(1);
    const maxRound = Math.max(...winners.map((m) => m.round));
    expect(finals[0].round).toBe(maxRound);
  });

  it('keeps all feeder references pointing at existing matches', () => {
    const matches = generateSingleElimination(players(16), { thirdPlaceMatch: true });
    const ids = new Set(matches.map((m) => m.id));
    for (const m of matches) {
      for (const slot of [m.slotA, m.slotB]) {
        if (slot.kind === 'WINNER_OF' || slot.kind === 'LOSER_OF') {
          expect(ids.has(slot.matchId)).toBe(true);
        }
      }
      if (m.winnerTo) expect(ids.has(m.winnerTo.matchId)).toBe(true);
      if (m.loserTo) expect(ids.has(m.loserTo.matchId)).toBe(true);
    }
  });

  it('adds a third-place match fed by the two semi-final losers', () => {
    const matches = generateSingleElimination(players(8), { thirdPlaceMatch: true });
    const thirdPlace = matches.find((m) => m.phase === 'THIRD_PLACE');
    expect(thirdPlace).toBeDefined();
    expect(thirdPlace!.slotA.kind).toBe('LOSER_OF');
    expect(thirdPlace!.slotB.kind).toBe('LOSER_OF');

    const semis = matches.filter((m) => m.phase === 'WINNERS' && m.loserTo);
    expect(semis).toHaveLength(2);
    for (const semi of semis) {
      expect(semi.loserTo!.matchId).toBe(thirdPlace!.id);
    }
  });

  it('omits the third-place match with only 2 players', () => {
    const matches = generateSingleElimination(players(2), { thirdPlaceMatch: true });
    expect(matches.find((m) => m.phase === 'THIRD_PLACE')).toBeUndefined();
  });
});
