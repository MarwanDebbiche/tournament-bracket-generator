import type { Match, MatchResult, TiebreakerRule } from './types';

export interface StandingRow {
  playerId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface StandingsOptions {
  points: { win: number; draw: number; loss: number };
  tiebreakers: TiebreakerRule[];
}

function emptyRow(playerId: string): StandingRow {
  return {
    playerId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

/** Points earned by each id considering only matches among the given id set. */
function headToHeadPoints(
  ids: Set<string>,
  matches: Match[],
  results: Record<string, MatchResult>,
  points: StandingsOptions['points'],
): Record<string, number> {
  const table: Record<string, number> = {};
  for (const id of ids) table[id] = 0;

  for (const match of matches) {
    const result = results[match.id];
    if (!result) continue;
    const { sideAPlayerId: a, sideBPlayerId: b, winnerId } = result;
    if (!ids.has(a) || !ids.has(b)) continue;
    if (winnerId === null) {
      table[a] += points.draw;
      table[b] += points.draw;
    } else if (winnerId === a) {
      table[a] += points.win;
      table[b] += points.loss;
    } else if (winnerId === b) {
      table[b] += points.win;
      table[a] += points.loss;
    }
  }
  return table;
}

function tiebreakDelta(
  rule: TiebreakerRule,
  a: StandingRow,
  b: StandingRow,
  headToHead: Record<string, number>,
): number {
  switch (rule) {
    case 'HEAD_TO_HEAD':
      return (headToHead[b.playerId] ?? 0) - (headToHead[a.playerId] ?? 0);
    case 'GOAL_DIFFERENCE':
      return b.goalDifference - a.goalDifference;
    case 'GOALS_FOR':
      return b.goalsFor - a.goalsFor;
    case 'WINS':
      return b.won - a.won;
    case 'MANUAL':
      return 0;
  }
}

/**
 * Compute ranked standings for a group. Rows are ordered by points, then by the
 * configured tiebreakers applied within each set of players level on points
 * (head-to-head is computed among only the tied players). Ties that survive all
 * rules keep their original (seed) order.
 */
export function computeStandings(
  playerIds: string[],
  matches: Match[],
  results: Record<string, MatchResult>,
  options: StandingsOptions,
): StandingRow[] {
  const rows = new Map(playerIds.map((id) => [id, emptyRow(id)]));
  const { points } = options;

  for (const match of matches) {
    const result = results[match.id];
    if (!result) continue;
    const { sideAPlayerId: a, sideBPlayerId: b, winnerId } = result;
    const rowA = rows.get(a);
    const rowB = rows.get(b);
    if (!rowA || !rowB) continue;

    const scoreA = result.scoreA ?? 0;
    const scoreB = result.scoreB ?? 0;
    rowA.played += 1;
    rowB.played += 1;
    rowA.goalsFor += scoreA;
    rowA.goalsAgainst += scoreB;
    rowB.goalsFor += scoreB;
    rowB.goalsAgainst += scoreA;

    if (winnerId === null) {
      rowA.drawn += 1;
      rowB.drawn += 1;
      rowA.points += points.draw;
      rowB.points += points.draw;
    } else if (winnerId === a) {
      rowA.won += 1;
      rowB.lost += 1;
      rowA.points += points.win;
      rowB.points += points.loss;
    } else if (winnerId === b) {
      rowB.won += 1;
      rowA.lost += 1;
      rowB.points += points.win;
      rowA.points += points.loss;
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  const originalIndex = new Map(playerIds.map((id, i) => [id, i]));
  const ordered = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      originalIndex.get(a.playerId)! - originalIndex.get(b.playerId)!,
  );

  // Resolve each cluster of equal-points rows with the tiebreaker chain.
  const ranked: StandingRow[] = [];
  for (let i = 0; i < ordered.length; ) {
    let j = i;
    while (j < ordered.length && ordered[j].points === ordered[i].points) j++;
    const cluster = ordered.slice(i, j);
    if (cluster.length > 1) {
      const ids = new Set(cluster.map((r) => r.playerId));
      const h2h = headToHeadPoints(ids, matches, results, points);
      cluster.sort((a, b) => {
        for (const rule of options.tiebreakers) {
          const delta = tiebreakDelta(rule, a, b, h2h);
          if (delta !== 0) return delta;
        }
        return originalIndex.get(a.playerId)! - originalIndex.get(b.playerId)!;
      });
    }
    ranked.push(...cluster);
    i = j;
  }

  return ranked;
}
