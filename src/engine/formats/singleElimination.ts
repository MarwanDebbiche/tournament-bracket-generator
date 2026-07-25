import type { Match, Player, Slot } from '../types';
import { nextPowerOfTwo } from '../validation';
import { seedOrder } from '../seeding';

export interface SingleElimOptions {
  thirdPlaceMatch?: boolean;
}

/**
 * Build a single-elimination bracket from entrants given in seed order
 * (entrants[0] is the top seed). Each entrant is a slot — a concrete player, or
 * a placeholder such as a group-rank reference. The field is padded to the next
 * power of two with byes assigned to the top seeds. Match ids are deterministic.
 */
export function buildSingleEliminationFromEntrants(
  entrants: Slot[],
  options: SingleElimOptions = {},
): Match[] {
  const entrantCount = entrants.length;
  if (entrantCount < 2) {
    throw new Error('Single elimination needs at least 2 entrants.');
  }

  const size = nextPowerOfTwo(entrantCount);
  const order = seedOrder(size);
  const rounds = Math.round(Math.log2(size));
  const matches: Match[] = [];

  const slotForSeed = (seed: number): Slot =>
    seed <= entrantCount ? entrants[seed - 1] : { kind: 'BYE' };

  // First round, seeded from the standard order.
  const firstRound: Match[] = [];
  for (let i = 0; i < size / 2; i++) {
    firstRound.push({
      id: `W-0-${i}`,
      phase: 'WINNERS',
      round: 0,
      order: i,
      slotA: slotForSeed(order[2 * i]),
      slotB: slotForSeed(order[2 * i + 1]),
    });
  }
  matches.push(...firstRound);

  // Later rounds: each match is fed by two matches from the previous round.
  let previous = firstRound;
  for (let round = 1; round < rounds; round++) {
    const count = size / 2 ** (round + 1);
    const current: Match[] = [];
    for (let j = 0; j < count; j++) {
      const feederA = previous[2 * j];
      const feederB = previous[2 * j + 1];
      const match: Match = {
        id: `W-${round}-${j}`,
        phase: 'WINNERS',
        round,
        order: j,
        slotA: { kind: 'WINNER_OF', matchId: feederA.id },
        slotB: { kind: 'WINNER_OF', matchId: feederB.id },
      };
      feederA.winnerTo = { matchId: match.id, side: 'A' };
      feederB.winnerTo = { matchId: match.id, side: 'B' };
      current.push(match);
    }
    matches.push(...current);
    previous = current;
  }

  // Optional third-place match between the two semi-final losers.
  if (options.thirdPlaceMatch && rounds >= 2) {
    const semis = matches.filter(
      (m) => m.phase === 'WINNERS' && m.round === rounds - 2,
    );
    const [semiA, semiB] = semis;
    const thirdPlace: Match = {
      id: 'TP',
      phase: 'THIRD_PLACE',
      round: rounds - 1,
      order: 1,
      slotA: { kind: 'LOSER_OF', matchId: semiA.id },
      slotB: { kind: 'LOSER_OF', matchId: semiB.id },
    };
    semiA.loserTo = { matchId: thirdPlace.id, side: 'A' };
    semiB.loserTo = { matchId: thirdPlace.id, side: 'B' };
    matches.push(thirdPlace);
  }

  return matches;
}

/** Build a single-elimination bracket directly from players in seed order. */
export function generateSingleElimination(
  players: Player[],
  options: SingleElimOptions = {},
): Match[] {
  return buildSingleEliminationFromEntrants(
    players.map((p) => ({ kind: 'PLAYER', playerId: p.id })),
    options,
  );
}
