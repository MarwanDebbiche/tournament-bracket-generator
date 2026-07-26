import type { Match, MatchResult, Player, Slot, SwissConfig } from '../types';

/**
 * A Swiss stage's pairings can't be generated up front: each round depends on
 * the results of the previous one. Instead `resolve()` calls `buildSwissMatches`
 * on every evaluation to derive the live set of Swiss matches from the (frozen)
 * seed order and the current results — round 0 always exists; each further round
 * appears only once its predecessor is fully played. This keeps the engine's
 * "structure + results → derived state" model intact for Swiss too.
 */

export interface SwissStandingRow {
  playerId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  /** Buchholz score: sum of opponents' points (byes excluded). Tiebreaker. */
  buchholz: number;
}

interface Pairing {
  a: string;
  /** null = this player receives a bye (a free win). */
  b: string | null;
}

const byeMatchId = (round: number) => `S-${round}-bye`;
const swissMatchId = (round: number, index: number) => `S-${round}-${index}`;

function isByeMatch(match: Match): boolean {
  return match.slotB.kind === 'BYE';
}

/** The real (non-bye) result stored for a match, or null if absent/stale. */
function validResult(
  match: Match,
  results: Record<string, MatchResult>,
): MatchResult | null {
  const result = results[match.id];
  if (!result) return null;
  const a = match.slotA.kind === 'PLAYER' ? match.slotA.playerId : null;
  const b = match.slotB.kind === 'PLAYER' ? match.slotB.playerId : null;
  if (a === null || b === null) return null;
  return result.sideAPlayerId === a && result.sideBPlayerId === b ? result : null;
}

/** A round is complete once every match has a valid result (byes count as played). */
function roundComplete(
  round: Match[],
  results: Record<string, MatchResult>,
): boolean {
  return round.every((m) => isByeMatch(m) || validResult(m, results) !== null);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Pairs (unordered) that have already met, so later rounds can avoid rematches. */
function playedPairs(matches: Match[]): Set<string> {
  const set = new Set<string>();
  for (const m of matches) {
    if (m.phase !== 'SWISS' || isByeMatch(m)) continue;
    const a = m.slotA.kind === 'PLAYER' ? m.slotA.playerId : null;
    const b = m.slotB.kind === 'PLAYER' ? m.slotB.playerId : null;
    if (a && b) set.add(pairKey(a, b));
  }
  return set;
}

/** Players who have already received a bye (each player should get at most one). */
function byePlayers(matches: Match[]): Set<string> {
  const set = new Set<string>();
  for (const m of matches) {
    if (m.phase === 'SWISS' && isByeMatch(m) && m.slotA.kind === 'PLAYER') {
      set.add(m.slotA.playerId);
    }
  }
  return set;
}

function pairingsToMatches(pairings: Pairing[], round: number): Match[] {
  return pairings.map((pairing, index) => {
    const slotA: Slot = { kind: 'PLAYER', playerId: pairing.a };
    if (pairing.b === null) {
      return {
        id: byeMatchId(round),
        phase: 'SWISS',
        round,
        order: index,
        slotA,
        slotB: { kind: 'BYE' },
      } satisfies Match;
    }
    return {
      id: swissMatchId(round, index),
      phase: 'SWISS',
      round,
      order: index,
      slotA,
      slotB: { kind: 'PLAYER', playerId: pairing.b },
    } satisfies Match;
  });
}

/**
 * Round 1: classic "fold" pairing on seed order — the top half plays the bottom
 * half (seed 1 v seed h+1, …). With an odd field the lowest seed sits out.
 */
function foldPairings(playerIds: string[]): Pairing[] {
  const list = [...playerIds];
  const bye = list.length % 2 === 1 ? list.pop()! : null;
  const half = list.length / 2;
  const pairings: Pairing[] = [];
  for (let i = 0; i < half; i++) {
    pairings.push({ a: list[i], b: list[i + half] });
  }
  if (bye) pairings.push({ a: bye, b: null });
  return pairings;
}

/**
 * Later rounds: order players by current standing, then greedily pair each
 * player with the nearest-ranked opponent they haven't met yet (falling back to
 * a rematch only if unavoidable). An odd field gives a bye to the lowest-ranked
 * player who hasn't had one.
 */
function pairByStandings(
  standings: SwissStandingRow[],
  priorMatches: Match[],
): Pairing[] {
  const played = playedPairs(priorMatches);
  const hadBye = byePlayers(priorMatches);
  const active = standings.map((row) => row.playerId);

  let byePlayer: string | null = null;
  if (active.length % 2 === 1) {
    let idx = active.length - 1;
    while (idx >= 0 && hadBye.has(active[idx])) idx--;
    if (idx < 0) idx = active.length - 1; // everyone already had one
    byePlayer = active.splice(idx, 1)[0];
  }

  const paired = new Set<string>();
  const pairings: Pairing[] = [];
  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    if (paired.has(a)) continue;
    let partner: string | null = null;
    for (let j = i + 1; j < active.length; j++) {
      const b = active[j];
      if (paired.has(b) || played.has(pairKey(a, b))) continue;
      partner = b;
      break;
    }
    if (partner === null) {
      // Everyone left has already been played — accept the nearest rematch.
      for (let j = i + 1; j < active.length; j++) {
        if (!paired.has(active[j])) {
          partner = active[j];
          break;
        }
      }
    }
    if (partner === null) continue;
    paired.add(a);
    paired.add(partner);
    pairings.push({ a, b: partner });
  }
  if (byePlayer) pairings.push({ a: byePlayer, b: null });
  return pairings;
}

/**
 * Standings after the Swiss matches played so far: points (with byes scored as
 * wins), win/draw/loss tallies, and Buchholz. Ordered best-first — points, then
 * Buchholz, then seed order (the order of `playerIds`).
 */
export function computeSwissStandings(
  playerIds: string[],
  matches: Match[],
  results: Record<string, MatchResult>,
  points: SwissConfig['points'],
): SwissStandingRow[] {
  const rows = new Map<string, SwissStandingRow>(
    playerIds.map((id) => [
      id,
      { playerId: id, played: 0, won: 0, drawn: 0, lost: 0, points: 0, buchholz: 0 },
    ]),
  );
  const opponents = new Map<string, string[]>(playerIds.map((id) => [id, []]));

  for (const match of matches) {
    if (match.phase !== 'SWISS') continue;
    const a = match.slotA.kind === 'PLAYER' ? match.slotA.playerId : null;

    if (isByeMatch(match)) {
      const row = a ? rows.get(a) : undefined;
      if (row) {
        row.played += 1;
        row.won += 1;
        row.points += points.win;
      }
      continue;
    }

    const result = validResult(match, results);
    const b = match.slotB.kind === 'PLAYER' ? match.slotB.playerId : null;
    if (!result || a === null || b === null) continue;
    const rowA = rows.get(a);
    const rowB = rows.get(b);
    if (!rowA || !rowB) continue;

    rowA.played += 1;
    rowB.played += 1;
    opponents.get(a)!.push(b);
    opponents.get(b)!.push(a);

    if (result.winnerId === null) {
      rowA.drawn += 1;
      rowB.drawn += 1;
      rowA.points += points.draw;
      rowB.points += points.draw;
    } else if (result.winnerId === a) {
      rowA.won += 1;
      rowB.lost += 1;
      rowA.points += points.win;
      rowB.points += points.loss;
    } else if (result.winnerId === b) {
      rowB.won += 1;
      rowA.lost += 1;
      rowB.points += points.win;
      rowA.points += points.loss;
    }
  }

  for (const [id, opps] of opponents) {
    const row = rows.get(id)!;
    row.buchholz = opps.reduce((sum, opp) => sum + (rows.get(opp)?.points ?? 0), 0);
  }

  const seedIndex = new Map(playerIds.map((id, i) => [id, i]));
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.buchholz - x.buchholz ||
      seedIndex.get(x.playerId)! - seedIndex.get(y.playerId)!,
  );
}

/**
 * Derive the live Swiss match set from the seed order and current results.
 * Round 0 is always present; each subsequent round (up to `config.rounds`)
 * appears only once its predecessor is fully played. Deterministic: the same
 * players and results always yield the same matches.
 */
export function buildSwissMatches(
  players: Player[],
  results: Record<string, MatchResult>,
  config: SwissConfig,
): Match[] {
  const ids = players.map((p) => p.id);
  const totalRounds = Math.max(0, Math.floor(config.rounds));
  if (ids.length < 2 || totalRounds < 1) return [];

  const matches: Match[] = [];
  const rounds: Match[][] = [];

  const first = pairingsToMatches(foldPairings(ids), 0);
  rounds.push(first);
  matches.push(...first);

  for (let r = 1; r < totalRounds; r++) {
    if (!roundComplete(rounds[r - 1], results)) break;
    const standings = computeSwissStandings(ids, matches, results, config.points);
    const next = pairingsToMatches(pairByStandings(standings, matches), r);
    if (next.length === 0) break;
    rounds.push(next);
    matches.push(...next);
  }

  return matches;
}

/** True once every configured Swiss round has been generated and fully played. */
export function swissStageComplete(
  swissMatches: Match[],
  results: Record<string, MatchResult>,
  config: SwissConfig,
): boolean {
  if (swissMatches.length === 0) return false;
  const roundsGenerated = Math.max(...swissMatches.map((m) => m.round)) + 1;
  if (roundsGenerated < Math.floor(config.rounds)) return false;
  return swissMatches.every((m) => isByeMatch(m) || validResult(m, results) !== null);
}

/**
 * Entrant slots for the knockout that follows a Swiss stage, one per qualifier
 * in seed order (SEED 1 = the Swiss leader). The player behind each seed is
 * resolved from the final Swiss standings once the stage completes.
 */
export function swissSeedSlots(advance: number): Slot[] {
  return Array.from({ length: Math.max(0, advance) }, (_, i) => ({
    kind: 'SEED',
    seed: i + 1,
  }));
}
