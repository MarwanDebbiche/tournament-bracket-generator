import { describe, expect, it } from 'vitest';
import { computeStandings } from './standings';
import type { StandingsOptions } from './standings';
import type { Match, MatchResult } from './types';

const OPTIONS: StandingsOptions = {
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['HEAD_TO_HEAD', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'WINS', 'MANUAL'],
};

interface Game {
  a: string;
  b: string;
  sa: number;
  sb: number;
}

function buildGroup(games: Game[]): {
  matches: Match[];
  results: Record<string, MatchResult>;
} {
  const matches: Match[] = [];
  const results: Record<string, MatchResult> = {};
  games.forEach((g, i) => {
    const id = `m${i}`;
    matches.push({
      id,
      phase: 'GROUP',
      round: 0,
      order: i,
      slotA: { kind: 'PLAYER', playerId: g.a },
      slotB: { kind: 'PLAYER', playerId: g.b },
    });
    results[id] = {
      sideAPlayerId: g.a,
      sideBPlayerId: g.b,
      scoreA: g.sa,
      scoreB: g.sb,
      winnerId: g.sa > g.sb ? g.a : g.sb > g.sa ? g.b : null,
    };
  });
  return { matches, results };
}

function order(playerIds: string[], games: Game[]): string[] {
  const { matches, results } = buildGroup(games);
  return computeStandings(playerIds, matches, results, OPTIONS).map((r) => r.playerId);
}

describe('computeStandings', () => {
  it('ranks by points', () => {
    // A wins both, B beats C.
    expect(
      order(['A', 'B', 'C'], [
        { a: 'A', b: 'B', sa: 1, sb: 0 },
        { a: 'A', b: 'C', sa: 1, sb: 0 },
        { a: 'B', b: 'C', sa: 1, sb: 0 },
      ]),
    ).toEqual(['A', 'B', 'C']);
  });

  it('accumulates W/D/L, goals, and points correctly', () => {
    const { matches, results } = buildGroup([
      { a: 'A', b: 'B', sa: 2, sb: 2 },
      { a: 'A', b: 'C', sa: 3, sb: 1 },
    ]);
    const rows = computeStandings(['A', 'B', 'C'], matches, results, OPTIONS);
    const a = rows.find((r) => r.playerId === 'A')!;
    expect(a).toMatchObject({
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      goalsFor: 5,
      goalsAgainst: 3,
      goalDifference: 2,
      points: 4,
    });
  });

  it('breaks a two-way tie on head-to-head', () => {
    // A and B both finish on 6; A beat B head-to-head → A above B.
    // C and D both finish on 3; D beat C → D above C.
    expect(
      order(['A', 'B', 'C', 'D'], [
        { a: 'A', b: 'B', sa: 1, sb: 0 },
        { a: 'A', b: 'C', sa: 0, sb: 1 },
        { a: 'A', b: 'D', sa: 1, sb: 0 },
        { a: 'B', b: 'C', sa: 1, sb: 0 },
        { a: 'B', b: 'D', sa: 1, sb: 0 },
        { a: 'C', b: 'D', sa: 0, sb: 1 },
      ]),
    ).toEqual(['A', 'B', 'D', 'C']);
  });

  it('falls through to goal difference when head-to-head is level', () => {
    // A and B draw head-to-head and finish level on points; A has the better GD.
    expect(
      order(['A', 'B', 'C'], [
        { a: 'A', b: 'B', sa: 1, sb: 1 },
        { a: 'A', b: 'C', sa: 5, sb: 0 },
        { a: 'B', b: 'C', sa: 1, sb: 0 },
      ]),
    ).toEqual(['A', 'B', 'C']);
  });

  it('handles a group with no results yet (all level, seed order kept)', () => {
    expect(order(['A', 'B', 'C'], [])).toEqual(['A', 'B', 'C']);
  });
});
