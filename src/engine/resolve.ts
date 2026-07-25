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
  /** The valid stored result, if any (absent for walkovers and stale results). */
  result?: MatchResult;
}

export interface DerivedState {
  byId: Record<string, ResolvedMatch>;
  matches: ResolvedMatch[];
  /** Ids of matches ready to be played now (both entrants known, no result). */
  playableMatchIds: string[];
  /** Ranked standings per group id. */
  standings: Record<string, StandingRow[]>;
  /** Whether every match in a group has a recorded result. */
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
      if (source?.status === 'DONE' && source.winnerId) {
        return { kind: 'PLAYER', playerId: source.winnerId };
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

  // Walkover: one real player against a bye.
  if (aPlayer && sideB.kind === 'BYE') {
    return { ...base, status: 'DONE', winnerId: aPlayer, isWalkover: true };
  }
  if (bPlayer && sideA.kind === 'BYE') {
    return { ...base, status: 'DONE', winnerId: bPlayer, isWalkover: true };
  }
  // Degenerate bye-vs-bye (should never happen) — done, no winner.
  if (sideA.kind === 'BYE' && sideB.kind === 'BYE') {
    return { ...base, status: 'DONE' };
  }
  // Waiting on an upstream match or group standings.
  if (!aPlayer || !bPlayer) {
    return { ...base, status: 'PENDING' };
  }

  // Both entrants known. A stored result is valid only if it was recorded for
  // exactly these two players; otherwise an upstream edit invalidated it.
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

/**
 * Derive the full live state of a tournament from its (frozen) structure and its
 * results map. Pure: same inputs always produce the same output.
 */
export function resolve(tournament: Tournament): DerivedState {
  const { matches, results, groups, config } = tournament;

  // Group standings and completion.
  const groupOptions: StandingsOptions = config.groupStage
    ? {
        points: config.groupStage.points,
        tiebreakers: config.groupStage.tiebreakers,
      }
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

  // Feeders only reference earlier rounds; group standings are precomputed, so
  // ascending round order is a valid processing order.
  const byId: Record<string, ResolvedMatch> = {};
  const ctx: SlotContext = { byId, standings, groupsComplete };
  const processing = [...matches].sort((a, b) => a.round - b.round);
  for (const match of processing) {
    byId[match.id] = evaluate(
      match,
      resolveSlot(match.slotA, ctx),
      resolveSlot(match.slotB, ctx),
      results[match.id],
    );
  }

  const resolvedMatches = matches.map((m) => byId[m.id]);

  const winners = matches.filter((m) => m.phase === 'WINNERS');
  const finalMatch =
    winners.length > 0
      ? winners.reduce((best, m) => (m.round > best.round ? m : best))
      : undefined;
  const finalResolved = finalMatch ? byId[finalMatch.id] : undefined;

  const thirdPlaceMatch = matches.find((m) => m.phase === 'THIRD_PLACE');
  const thirdResolved = thirdPlaceMatch ? byId[thirdPlaceMatch.id] : undefined;

  const isComplete =
    resolvedMatches.length > 0 &&
    resolvedMatches.every((m) => m.status === 'DONE');

  return {
    byId,
    matches: resolvedMatches,
    playableMatchIds: resolvedMatches
      .filter((m) => m.status === 'READY')
      .map((m) => m.id),
    standings,
    groupsComplete,
    champion: finalResolved?.status === 'DONE' ? finalResolved.winnerId : undefined,
    runnerUp: finalResolved?.status === 'DONE' ? finalResolved.loserId : undefined,
    thirdPlace:
      thirdResolved?.status === 'DONE' ? thirdResolved.winnerId : undefined,
    fourthPlace:
      thirdResolved?.status === 'DONE' ? thirdResolved.loserId : undefined,
    isComplete,
  };
}
