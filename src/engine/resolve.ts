import type { Group, Match, MatchResult, Slot, Tournament } from './types';
import { computeStandings } from './standings';
import type { StandingRow, StandingsOptions } from './standings';

/** A match slot resolved to a concrete occupant. */
export type ResolvedSide =
  | { kind: 'PLAYER'; playerId: string }
  | { kind: 'TBD' }
  | { kind: 'BYE' };

export interface ResolvedMatch {
  id: string;
  match: Match;
  sideA: ResolvedSide;
  sideB: ResolvedSide;
  status: 'PENDING' | 'READY' | 'DONE';
  /** Winner's player id (DONE matches with a decided winner). */
  winnerId?: string;
  /** Loser's player id (DONE matches with two real players). */
  loserId?: string;
  /** Decided automatically by a bye — no user input needed. */
  isWalkover: boolean;
  /** Not part of the played-out tournament (e.g. an unneeded grand-final reset). */
  skipped?: boolean;
  /** The valid stored result, if any (absent for walkovers and stale results). */
  result?: MatchResult;
}

export interface DerivedState {
  byId: Record<string, ResolvedMatch>;
  matches: ResolvedMatch[];
  playableMatchIds: string[];
  standings: Record<string, StandingRow[]>;
  groupsComplete: Record<string, boolean>;
  /** Knockout seeding of the qualifiers (best first) once all groups finish. */
  qualifierSeeding?: string[];
  champion?: string;
  runnerUp?: string;
  thirdPlace?: string;
  fourthPlace?: string;
  isComplete: boolean;
}

interface SlotContext {
  byId: Record<string, ResolvedMatch>;
  standings: Record<string, StandingRow[]>;
  groupsComplete: Record<string, boolean>;
  qualifierSeeding?: string[];
}

function resolveSlot(slot: Slot, ctx: SlotContext): ResolvedSide {
  switch (slot.kind) {
    case 'PLAYER':
      return { kind: 'PLAYER', playerId: slot.playerId };
    case 'BYE':
      return { kind: 'BYE' };
    case 'WINNER_OF': {
      const source = ctx.byId[slot.matchId];
      if (source?.status === 'DONE') {
        // A completed match with no winner (a fully-bye match) collapses to a bye.
        return source.winnerId
          ? { kind: 'PLAYER', playerId: source.winnerId }
          : { kind: 'BYE' };
      }
      return { kind: 'TBD' };
    }
    case 'LOSER_OF': {
      const source = ctx.byId[slot.matchId];
      if (source?.status === 'DONE') {
        return source.loserId
          ? { kind: 'PLAYER', playerId: source.loserId }
          : { kind: 'BYE' };
      }
      return { kind: 'TBD' };
    }
    case 'GROUP_RANK': {
      // Legacy positional seeding (kept for tournaments launched before merit
      // seeding). New tournaments use SEED slots.
      if (!ctx.groupsComplete[slot.groupId]) return { kind: 'TBD' };
      const row = ctx.standings[slot.groupId]?.[slot.rank - 1];
      return row ? { kind: 'PLAYER', playerId: row.playerId } : { kind: 'TBD' };
    }
    case 'SEED': {
      const playerId = ctx.qualifierSeeding?.[slot.seed - 1];
      return playerId ? { kind: 'PLAYER', playerId } : { kind: 'TBD' };
    }
  }
}

function evaluate(
  match: Match,
  sideA: ResolvedSide,
  sideB: ResolvedSide,
  result: MatchResult | undefined,
): ResolvedMatch {
  const base = { id: match.id, match, sideA, sideB, isWalkover: false };

  const aPlayer = sideA.kind === 'PLAYER' ? sideA.playerId : null;
  const bPlayer = sideB.kind === 'PLAYER' ? sideB.playerId : null;

  if (aPlayer && sideB.kind === 'BYE') {
    return { ...base, status: 'DONE', winnerId: aPlayer, isWalkover: true };
  }
  if (bPlayer && sideA.kind === 'BYE') {
    return { ...base, status: 'DONE', winnerId: bPlayer, isWalkover: true };
  }
  // Fully-bye match (can appear in a losers bracket with many byes) — no winner.
  if (sideA.kind === 'BYE' && sideB.kind === 'BYE') {
    return { ...base, status: 'DONE', isWalkover: true };
  }
  if (!aPlayer || !bPlayer) {
    return { ...base, status: 'PENDING' };
  }

  const valid =
    result &&
    result.sideAPlayerId === aPlayer &&
    result.sideBPlayerId === bPlayer;

  if (valid) {
    if (result.winnerId === null) {
      return { ...base, status: 'DONE', result }; // draw (group phase)
    }
    const loserId = result.winnerId === aPlayer ? bPlayer : aPlayer;
    return { ...base, status: 'DONE', winnerId: result.winnerId, loserId, result };
  }

  return { ...base, status: 'READY' };
}

/** Dependency-respecting order: a match comes after every match its slots feed from. */
function topologicalOrder(matches: Match[]): Match[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const ordered: Match[] = [];
  const visited = new Set<string>();

  const visit = (match: Match) => {
    if (visited.has(match.id)) return;
    visited.add(match.id);
    for (const slot of [match.slotA, match.slotB]) {
      if (slot.kind === 'WINNER_OF' || slot.kind === 'LOSER_OF') {
        const dep = byId.get(slot.matchId);
        if (dep) visit(dep);
      }
    }
    ordered.push(match);
  };

  for (const match of matches) visit(match);
  return ordered;
}

function pointsPerGame(row: StandingRow): number {
  return row.played > 0 ? row.points / row.played : 0;
}

/**
 * Overall knockout seeding of the group qualifiers, best first. Group winners
 * are seeded above runners-up (and so on); within each rank band, qualifiers
 * are ordered by their group-stage record — points per game (fair across
 * uneven groups), then goal difference, goals for, and wins — so byes and
 * favorable slots go to the best performers. Ties fall back to group order.
 */
export function seedQualifiers(
  groups: Group[],
  standings: Record<string, StandingRow[]>,
  advancePerGroup: number,
): string[] {
  const seeding: string[] = [];
  for (let rank = 0; rank < advancePerGroup; rank++) {
    const band = groups
      .map((group, index) => ({ index, row: standings[group.id]?.[rank] }))
      .filter((entry): entry is { index: number; row: StandingRow } =>
        Boolean(entry.row),
      )
      .sort(
        (a, b) =>
          pointsPerGame(b.row) - pointsPerGame(a.row) ||
          b.row.goalDifference - a.row.goalDifference ||
          b.row.goalsFor - a.row.goalsFor ||
          b.row.won - a.row.won ||
          a.index - b.index,
      );
    for (const entry of band) seeding.push(entry.row.playerId);
  }
  return seeding;
}

/**
 * Derive the full live state of a tournament from its (frozen) structure and its
 * results map. Pure: same inputs always produce the same output.
 */
export function resolve(tournament: Tournament): DerivedState {
  const { matches, results, groups, config } = tournament;

  const groupOptions: StandingsOptions = config.groupStage
    ? { points: config.groupStage.points, tiebreakers: config.groupStage.tiebreakers }
    : { points: { win: 3, draw: 1, loss: 0 }, tiebreakers: [] };

  const standings: Record<string, StandingRow[]> = {};
  const groupsComplete: Record<string, boolean> = {};
  for (const group of groups) {
    const groupMatches = matches.filter(
      (m) => m.phase === 'GROUP' && m.groupId === group.id,
    );
    standings[group.id] = computeStandings(
      group.playerIds,
      groupMatches,
      results,
      groupOptions,
    );
    groupsComplete[group.id] =
      groupMatches.length > 0 && groupMatches.every((m) => Boolean(results[m.id]));
  }

  // Cross-group merit seeding needs every group's final standings.
  const allGroupsComplete =
    groups.length > 0 && groups.every((g) => groupsComplete[g.id]);
  const qualifierSeeding =
    config.groupStage && allGroupsComplete
      ? seedQualifiers(groups, standings, config.groupStage.advancePerGroup)
      : undefined;

  const byId: Record<string, ResolvedMatch> = {};
  const ctx: SlotContext = { byId, standings, groupsComplete, qualifierSeeding };
  for (const match of topologicalOrder(matches)) {
    byId[match.id] = evaluate(
      match,
      resolveSlot(match.slotA, ctx),
      resolveSlot(match.slotB, ctx),
      results[match.id],
    );
  }

  let champion: string | undefined;
  let runnerUp: string | undefined;
  let thirdPlace: string | undefined;
  let fourthPlace: string | undefined;

  const gf1 = matches.find((m) => m.phase === 'GRAND_FINAL' && m.round === 0);
  if (gf1) {
    // Double elimination — the grand final (and optional reset) decides it.
    const gf2 = matches.find((m) => m.phase === 'GRAND_FINAL' && m.round === 1);
    const r1 = byId[gf1.id];
    const wbPlayer = r1.sideA.kind === 'PLAYER' ? r1.sideA.playerId : undefined;
    if (r1.status === 'DONE' && r1.winnerId) {
      const winnersPlayerWon = r1.winnerId === wbPlayer;
      if (gf2 && !winnersPlayerWon) {
        const r2 = byId[gf2.id];
        if (r2.status === 'DONE' && r2.winnerId) {
          champion = r2.winnerId;
          runnerUp = r2.loserId;
        }
      } else {
        champion = r1.winnerId;
        runnerUp = r1.loserId;
        if (gf2) byId[gf2.id] = { ...byId[gf2.id], skipped: true };
      }
    }
  } else {
    // Single elimination (with or without groups) — the winners final decides it.
    const winners = matches.filter((m) => m.phase === 'WINNERS');
    const finalMatch =
      winners.length > 0
        ? winners.reduce((best, m) => (m.round > best.round ? m : best))
        : undefined;
    const finalResolved = finalMatch ? byId[finalMatch.id] : undefined;
    if (finalResolved?.status === 'DONE') {
      champion = finalResolved.winnerId;
      runnerUp = finalResolved.loserId;
    }
  }

  const thirdPlaceMatch = matches.find((m) => m.phase === 'THIRD_PLACE');
  const thirdResolved = thirdPlaceMatch ? byId[thirdPlaceMatch.id] : undefined;
  if (thirdResolved?.status === 'DONE') {
    thirdPlace = thirdResolved.winnerId;
    fourthPlace = thirdResolved.loserId;
  }

  const resolvedMatches = matches.map((m) => byId[m.id]);
  const isComplete =
    resolvedMatches.length > 0 &&
    resolvedMatches.every((m) => m.status === 'DONE' || m.skipped);

  return {
    byId,
    matches: resolvedMatches,
    playableMatchIds: resolvedMatches
      .filter((m) => m.status === 'READY' && !m.skipped)
      .map((m) => m.id),
    standings,
    groupsComplete,
    qualifierSeeding,
    champion,
    runnerUp,
    thirdPlace,
    fourthPlace,
    isComplete,
  };
}
