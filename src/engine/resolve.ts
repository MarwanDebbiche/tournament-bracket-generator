import type { Match, MatchResult, Slot, Tournament } from './types';
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
      if (!ctx.groupsComplete[slot.groupId]) return { kind: 'TBD' };
      const row = ctx.standings[slot.groupId]?.[slot.rank - 1];
      return row ? { kind: 'PLAYER', playerId: row.playerId } : { kind: 'TBD' };
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

  const byId: Record<string, ResolvedMatch> = {};
  const ctx: SlotContext = { byId, standings, groupsComplete };
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
    champion,
    runnerUp,
    thirdPlace,
    fourthPlace,
    isComplete,
  };
}
