import { describe, expect, it } from 'vitest';
import {
  buildSwissMatches,
  computeSwissStandings,
  swissSeedSlots,
  swissStageComplete,
} from './swiss';
import type { Match, MatchResult, Player, SwissConfig } from '../types';

const POINTS = { win: 3, draw: 1, loss: 0 };

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
}

function cfg(rounds: number, advance = 4): SwissConfig {
  return { rounds, advance, points: POINTS };
}

const pid = (m: Match, side: 'slotA' | 'slotB') =>
  m[side].kind === 'PLAYER' ? (m[side] as { playerId: string }).playerId : null;

const pairKey = (m: Match) => [pid(m, 'slotA'), pid(m, 'slotB')].sort().join('|');

/** Record a result; `winner` picks side A or B. Byes are skipped (auto-won). */
function play(
  results: Record<string, MatchResult>,
  m: Match,
  winner: 'A' | 'B' | 'DRAW',
) {
  const a = pid(m, 'slotA')!;
  const b = pid(m, 'slotB')!;
  results[m.id] = {
    sideAPlayerId: a,
    sideBPlayerId: b,
    scoreA: null,
    scoreB: null,
    winnerId: winner === 'DRAW' ? null : winner === 'A' ? a : b,
  };
}

/** Play a whole Swiss stage with the higher-ranked side (A) always winning. */
function playOut(roster: Player[], config: SwissConfig) {
  const results: Record<string, MatchResult> = {};
  let matches = buildSwissMatches(roster, results, config);
  let guard = 0;
  while (!swissStageComplete(matches, results, config) && guard++ < 100) {
    for (const m of matches) {
      if (m.slotB.kind === 'BYE' || results[m.id]) continue;
      play(results, m, 'A');
    }
    matches = buildSwissMatches(roster, results, config);
  }
  return { matches, results };
}

const roundOf = (matches: Match[], round: number) =>
  matches.filter((m) => m.round === round);

describe('buildSwissMatches — round 1 (fold pairing)', () => {
  it('pairs the top half against the bottom half', () => {
    const matches = buildSwissMatches(players(8), {}, cfg(1));
    expect(matches).toHaveLength(4);
    const pairs = matches.map(pairKey).sort();
    expect(pairs).toEqual(['p1|p5', 'p2|p6', 'p3|p7', 'p4|p8'].sort());
  });

  it('sits the lowest seed out on a bye when the field is odd', () => {
    const matches = buildSwissMatches(players(5), {}, cfg(1));
    expect(matches).toHaveLength(3);
    const bye = matches.find((m) => m.slotB.kind === 'BYE');
    expect(bye?.id).toBe('S-0-bye');
    expect(pid(bye!, 'slotA')).toBe('p5');
  });
});

describe('buildSwissMatches — round generation', () => {
  it('withholds later rounds until the previous one is fully played', () => {
    const roster = players(4);
    const first = buildSwissMatches(roster, {}, cfg(3));
    expect(Math.max(...first.map((m) => m.round))).toBe(0);

    const results: Record<string, MatchResult> = {};
    for (const m of roundOf(first, 0)) play(results, m, 'A');
    const second = buildSwissMatches(roster, results, cfg(3));
    expect(Math.max(...second.map((m) => m.round))).toBe(1);
  });

  it('never exceeds the configured number of rounds', () => {
    const { matches } = playOut(players(8), cfg(3));
    expect(Math.max(...matches.map((m) => m.round))).toBe(2);
  });
});

describe('buildSwissMatches — pairing quality', () => {
  it('avoids rematches when the field is large enough', () => {
    const { matches } = playOut(players(8), cfg(3));
    const played = matches.filter((m) => m.slotB.kind !== 'BYE').map(pairKey);
    expect(new Set(played).size).toBe(played.length); // all distinct
  });

  it('gives each player at most one bye while any player still lacks one', () => {
    const { matches } = playOut(players(5), cfg(4));
    const byes = matches
      .filter((m) => m.slotB.kind === 'BYE')
      .map((m) => pid(m, 'slotA'));
    expect(byes).toHaveLength(4); // one per round
    expect(new Set(byes).size).toBe(4); // all different players
  });
});

describe('computeSwissStandings', () => {
  it('scores a bye as a win', () => {
    const matches = buildSwissMatches(players(5), {}, cfg(1));
    const standings = computeSwissStandings(
      players(5).map((p) => p.id),
      matches,
      {},
      POINTS,
    );
    const byeRow = standings.find((r) => r.playerId === 'p5');
    expect(byeRow).toMatchObject({ played: 1, won: 1, points: 3 });
  });

  it('ranks the always-winning top seed first with a perfect score', () => {
    const config = cfg(3);
    const { matches, results } = playOut(players(8), config);
    const standings = computeSwissStandings(
      players(8).map((p) => p.id),
      matches,
      results,
      POINTS,
    );
    expect(standings[0].playerId).toBe('p1');
    expect(standings[0].points).toBe(9);
    expect(standings[0].won).toBe(3);
  });

  it('splits points on a draw and computes Buchholz from opponents', () => {
    const matches = buildSwissMatches(players(2), {}, cfg(1));
    const results: Record<string, MatchResult> = {};
    play(results, matches[0], 'DRAW');
    const standings = computeSwissStandings(['p1', 'p2'], matches, results, POINTS);
    expect(standings.every((r) => r.points === 1 && r.drawn === 1)).toBe(true);
    // Each player's only opponent has 1 point → Buchholz 1.
    expect(standings.every((r) => r.buchholz === 1)).toBe(true);
  });
});

describe('swissStageComplete', () => {
  it('is false mid-stage and true once every round is played', () => {
    const roster = players(8);
    const config = cfg(3);
    const first = buildSwissMatches(roster, {}, config);
    expect(swissStageComplete(first, {}, config)).toBe(false);

    const { matches, results } = playOut(roster, config);
    expect(swissStageComplete(matches, results, config)).toBe(true);
  });
});

describe('swissSeedSlots', () => {
  it('produces one SEED slot per advancing player, in order', () => {
    expect(swissSeedSlots(4)).toEqual([
      { kind: 'SEED', seed: 1 },
      { kind: 'SEED', seed: 2 },
      { kind: 'SEED', seed: 3 },
      { kind: 'SEED', seed: 4 },
    ]);
  });
});
