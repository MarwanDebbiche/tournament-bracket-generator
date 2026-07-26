import type { Match, Player, Side, Slot } from '../types';
import { nextPowerOfTwo } from '../validation';
import { seedOrder } from '../seeding';

/** Maps LB-major-round slot `i` to a winners-bracket dropout index. */
export type DropIndex = (slot: number, count: number, major: number) => number;

/**
 * Where each winners-bracket dropout enters a losers-bracket major round.
 * Reversing the dropouts avoids the immediate rematch; additionally rotating by
 * a half on alternate major rounds keeps players from meeting a prior winners-
 * bracket opponent until much later. (`major` is 1-based: 1 = first major round.)
 */
export const defaultDropIndex: DropIndex = (slot, count, major) => {
  const reversed = count - 1 - slot;
  return major % 2 === 0 ? (reversed + Math.floor(count / 2)) % count : reversed;
};

export interface DoubleElimOptions {
  grandFinalReset?: boolean;
  /** Override losers-bracket drop placement (used for analysis/testing). */
  dropIndex?: DropIndex;
}

function linkTo(from: Match, key: 'winnerTo' | 'loserTo', matchId: string, side: Side) {
  from[key] = { matchId, side };
}

/**
 * Build a double-elimination bracket from entrants in seed order.
 *
 * Winners bracket is a single-elimination bracket; every winners match sends its
 * loser into the losers bracket. The losers bracket alternates minor rounds (LB
 * survivors play each other) and major rounds (LB survivors meet the fresh
 * winners-bracket dropouts, placed via `defaultDropIndex` to avoid rematching a
 * winners-bracket opponent early). The winners- and losers-bracket champions
 * meet in the grand final;
 * with `grandFinalReset`, a second grand final is played if the losers-bracket
 * player wins the first (resolve() decides whether it is needed).
 */
export function buildDoubleEliminationFromEntrants(
  entrants: Slot[],
  options: DoubleElimOptions = {},
): Match[] {
  const entrantCount = entrants.length;
  if (entrantCount < 2) {
    throw new Error('Double elimination needs at least 2 entrants.');
  }

  const size = nextPowerOfTwo(entrantCount);
  const rounds = Math.round(Math.log2(size));
  const order = seedOrder(size);
  const slotForSeed = (seed: number): Slot =>
    seed <= entrantCount ? entrants[seed - 1] : { kind: 'BYE' };

  const matches: Match[] = [];

  // ---- Winners bracket ----
  const wbRounds: Match[][] = [];
  const wbFirst: Match[] = [];
  for (let i = 0; i < size / 2; i++) {
    wbFirst.push({
      id: `W-0-${i}`,
      phase: 'WINNERS',
      round: 0,
      order: i,
      slotA: slotForSeed(order[2 * i]),
      slotB: slotForSeed(order[2 * i + 1]),
    });
  }
  wbRounds.push(wbFirst);
  matches.push(...wbFirst);

  for (let r = 1; r < rounds; r++) {
    const prev = wbRounds[r - 1];
    const current: Match[] = [];
    for (let j = 0; j < prev.length / 2; j++) {
      const m: Match = {
        id: `W-${r}-${j}`,
        phase: 'WINNERS',
        round: r,
        order: j,
        slotA: { kind: 'WINNER_OF', matchId: prev[2 * j].id },
        slotB: { kind: 'WINNER_OF', matchId: prev[2 * j + 1].id },
      };
      linkTo(prev[2 * j], 'winnerTo', m.id, 'A');
      linkTo(prev[2 * j + 1], 'winnerTo', m.id, 'B');
      current.push(m);
    }
    wbRounds.push(current);
    matches.push(...current);
  }
  const wbFinal = wbRounds[rounds - 1][0];

  // ---- Losers bracket ----
  const lbRounds: Match[][] = [];
  let lbRound = 0;

  if (rounds >= 2) {
    // Minor round 0: pair up the winners-bracket first-round losers.
    const minor: Match[] = [];
    for (let i = 0; i < size / 4; i++) {
      const a = wbRounds[0][2 * i];
      const b = wbRounds[0][2 * i + 1];
      const m: Match = {
        id: `L-0-${i}`,
        phase: 'LOSERS',
        round: 0,
        order: i,
        slotA: { kind: 'LOSER_OF', matchId: a.id },
        slotB: { kind: 'LOSER_OF', matchId: b.id },
      };
      linkTo(a, 'loserTo', m.id, 'A');
      linkTo(b, 'loserTo', m.id, 'B');
      minor.push(m);
    }
    lbRounds.push(minor);
    matches.push(...minor);
    lbRound = 1;

    const dropIndex = options.dropIndex ?? defaultDropIndex;
    for (let j = 1; j < rounds; j++) {
      // Major round: LB survivors meet winners-bracket round-j dropouts.
      const prevLB = lbRounds[lbRounds.length - 1];
      const dropouts = wbRounds[j];
      const major: Match[] = [];
      for (let i = 0; i < prevLB.length; i++) {
        const drop = dropouts[dropIndex(i, dropouts.length, j)];
        const m: Match = {
          id: `L-${lbRound}-${i}`,
          phase: 'LOSERS',
          round: lbRound,
          order: i,
          slotA: { kind: 'WINNER_OF', matchId: prevLB[i].id },
          slotB: { kind: 'LOSER_OF', matchId: drop.id },
        };
        linkTo(prevLB[i], 'winnerTo', m.id, 'A');
        linkTo(drop, 'loserTo', m.id, 'B');
        major.push(m);
      }
      lbRounds.push(major);
      matches.push(...major);
      lbRound += 1;

      if (j < rounds - 1) {
        // Minor round: LB survivors play each other.
        const minorNext: Match[] = [];
        for (let i = 0; i < major.length / 2; i++) {
          const m: Match = {
            id: `L-${lbRound}-${i}`,
            phase: 'LOSERS',
            round: lbRound,
            order: i,
            slotA: { kind: 'WINNER_OF', matchId: major[2 * i].id },
            slotB: { kind: 'WINNER_OF', matchId: major[2 * i + 1].id },
          };
          linkTo(major[2 * i], 'winnerTo', m.id, 'A');
          linkTo(major[2 * i + 1], 'winnerTo', m.id, 'B');
          minorNext.push(m);
        }
        lbRounds.push(minorNext);
        matches.push(...minorNext);
        lbRound += 1;
      }
    }
  }

  const lbFinal = lbRounds.length ? lbRounds[lbRounds.length - 1][0] : undefined;

  // ---- Grand final ----
  const grandFinal: Match = {
    id: 'GF',
    phase: 'GRAND_FINAL',
    round: 0,
    order: 0,
    slotA: { kind: 'WINNER_OF', matchId: wbFinal.id },
    slotB: lbFinal
      ? { kind: 'WINNER_OF', matchId: lbFinal.id }
      : { kind: 'LOSER_OF', matchId: wbFinal.id },
  };
  linkTo(wbFinal, 'winnerTo', 'GF', 'A');
  if (lbFinal) {
    linkTo(lbFinal, 'winnerTo', 'GF', 'B');
  } else {
    linkTo(wbFinal, 'loserTo', 'GF', 'B');
  }
  matches.push(grandFinal);

  if (options.grandFinalReset) {
    const reset: Match = {
      id: 'GF2',
      phase: 'GRAND_FINAL',
      round: 1,
      order: 0,
      slotA: { kind: 'WINNER_OF', matchId: 'GF' },
      slotB: { kind: 'LOSER_OF', matchId: 'GF' },
    };
    linkTo(grandFinal, 'winnerTo', 'GF2', 'A');
    linkTo(grandFinal, 'loserTo', 'GF2', 'B');
    matches.push(reset);
  }

  return matches;
}

export function generateDoubleElimination(
  players: Player[],
  options: DoubleElimOptions = {},
): Match[] {
  return buildDoubleEliminationFromEntrants(
    players.map((p) => ({ kind: 'PLAYER', playerId: p.id })),
    options,
  );
}
