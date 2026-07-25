import type { Match, MatchResult, Slot, Tournament } from './types';

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
  champion?: string;
  runnerUp?: string;
  thirdPlace?: string;
  fourthPlace?: string;
  isComplete: boolean;
}

function resolveSlot(slot: Slot, byId: Record<string, ResolvedMatch>): ResolvedSide {
  switch (slot.kind) {
    case 'PLAYER':
      return { kind: 'PLAYER', playerId: slot.playerId };
    case 'BYE':
      return { kind: 'BYE' };
    case 'WINNER_OF': {
      const source = byId[slot.matchId];
      if (source?.status === 'DONE' && source.winnerId) {
        return { kind: 'PLAYER', playerId: source.winnerId };
      }
      return { kind: 'TBD' };
    }
    case 'LOSER_OF': {
      const source = byId[slot.matchId];
      if (source?.status === 'DONE') {
        // A source decided by a bye has no real loser → this slot is a bye.
        return source.loserId
          ? { kind: 'PLAYER', playerId: source.loserId }
          : { kind: 'BYE' };
      }
      return { kind: 'TBD' };
    }
    case 'GROUP_RANK':
      // Populated once group standings are resolved (later milestone).
      return { kind: 'TBD' };
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
  // Waiting on an upstream match.
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
  const { matches, results } = tournament;
  const byId: Record<string, ResolvedMatch> = {};

  // Feeders only ever reference earlier rounds, so ascending round order gives a
  // valid topological processing order.
  const processing = [...matches].sort((a, b) => a.round - b.round);
  for (const match of processing) {
    byId[match.id] = evaluate(
      match,
      resolveSlot(match.slotA, byId),
      resolveSlot(match.slotB, byId),
      results[match.id],
    );
  }

  const resolvedMatches = matches.map((m) => byId[m.id]);

  // The final is the highest-round match in the main (winners) bracket.
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
    champion: finalResolved?.status === 'DONE' ? finalResolved.winnerId : undefined,
    runnerUp: finalResolved?.status === 'DONE' ? finalResolved.loserId : undefined,
    thirdPlace:
      thirdResolved?.status === 'DONE' ? thirdResolved.winnerId : undefined,
    fourthPlace:
      thirdResolved?.status === 'DONE' ? thirdResolved.loserId : undefined,
    isComplete,
  };
}
