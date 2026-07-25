import { describe, expect, it } from 'vitest';
import { roundRobinSchedule } from './roundRobin';

describe('roundRobinSchedule', () => {
  it.each([
    [2, 1, 1],
    [3, 3, 3],
    [4, 6, 3],
    [5, 10, 5],
    [6, 15, 5],
    [8, 28, 7],
  ])('%i players → %i matches over %i rounds', (n, matches, rounds) => {
    const schedule = roundRobinSchedule(n);
    expect(schedule).toHaveLength(matches);
    expect(new Set(schedule.map((p) => p.round)).size).toBe(rounds);
  });

  it('pairs every player with every other exactly once', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const schedule = roundRobinSchedule(n);
      const seen = new Set<string>();
      for (const { home, away } of schedule) {
        const key = [home, away].sort((a, b) => a - b).join('-');
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      expect(seen.size).toBe((n * (n - 1)) / 2);
    }
  });

  it('never schedules a player twice in the same round', () => {
    for (const n of [4, 5, 6, 7]) {
      const schedule = roundRobinSchedule(n);
      const perRound = new Map<number, Set<number>>();
      for (const { round, home, away } of schedule) {
        const players = perRound.get(round) ?? new Set<number>();
        expect(players.has(home)).toBe(false);
        expect(players.has(away)).toBe(false);
        players.add(home);
        players.add(away);
        perRound.set(round, players);
      }
    }
  });
});
