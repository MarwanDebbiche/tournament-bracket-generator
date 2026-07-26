import type { Config, Player } from './types';

/** Smallest power of two that is >= n (0 for n < 1). */
export function nextPowerOfTwo(n: number): number {
  if (n < 1) return 0;
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

export interface KnockoutInfo {
  /** Players/qualifiers entering the elimination stage. */
  entrants: number;
  /** Next power of two >= entrants (0 when there are too few entrants). */
  bracketSize: number;
  /** Auto-advance slots (bracketSize - entrants). */
  byes: number;
}

export interface SetupValidation {
  /** True when there are no blocking errors and the tournament can launch. */
  ok: boolean;
  errors: string[];
  warnings: string[];
  knockout: KnockoutInfo;
  /**
   * Number of real matches that will actually be contested — group games plus
   * knockout games, excluding byes/walkovers and the conditional grand-final
   * reset (which may not be needed).
   */
  totalMatches: number;
  /**
   * Minimum number of sequential rounds ("steps") to complete the tournament if
   * every match that can be played in parallel is — bounded by each player only
   * playing one match at a time. A rough sense of how long the event runs.
   */
  sequentialSteps: number;
}

/**
 * Validate a player list + config for launch. Pure and side-effect free so the
 * wizard can call it on every render to drive live feedback.
 */
export function validateSetup(players: Player[], config: Config): SetupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Player names.
  const emptyNames = players.filter((p) => p.name.trim().length === 0).length;
  if (emptyNames > 0) {
    errors.push(
      emptyNames === 1
        ? '1 player has no name.'
        : `${emptyNames} players have no name.`,
    );
  }

  const seen = new Map<string, number>();
  for (const player of players) {
    const key = player.name.trim().toLowerCase();
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate player names: ${duplicates.join(', ')}.`);
  }

  // Entrants into the knockout stage.
  const playerCount = players.length;
  const group = config.groupStage;
  let entrants: number;

  if (group) {
    if (group.numGroups < 1) errors.push('There must be at least 1 group.');
    if (group.advancePerGroup < 1) {
      errors.push('At least 1 player must advance from each group.');
    }

    if (group.numGroups >= 1) {
      const smallestGroup = Math.floor(playerCount / group.numGroups);
      if (smallestGroup < 2) {
        errors.push(
          `${group.numGroups} groups need at least ${group.numGroups * 2} players (have ${playerCount}).`,
        );
      } else if (group.advancePerGroup > smallestGroup) {
        errors.push(
          `Can't advance ${group.advancePerGroup} players from groups of ${smallestGroup}.`,
        );
      }
    }

    entrants = group.numGroups * group.advancePerGroup;
  } else {
    entrants = playerCount;
  }

  if (entrants < 2) {
    errors.push('At least 2 players are needed to run a bracket.');
  }

  // Double elimination with 2 entrants collapses to a single final.
  if (config.knockout.type === 'DOUBLE_ELIM' && entrants === 2) {
    warnings.push('With 2 entrants, double elimination is just a single final.');
  }

  // Seeding from group standings requires a group stage.
  if (config.seeding === 'GROUP_STANDING' && !group) {
    errors.push('Group-standing seeding requires a group stage.');
  }

  const bracketSize = entrants >= 2 ? nextPowerOfTwo(entrants) : 0;
  const byes = bracketSize > 0 ? bracketSize - entrants : 0;

  // Real matches that will be contested (byes and the optional reset excluded).
  let totalMatches = 0;
  if (group && group.numGroups >= 1) {
    const perGroup = Math.floor(playerCount / group.numGroups);
    const larger = playerCount % group.numGroups;
    const games = (n: number) => (n * (n - 1)) / 2;
    totalMatches +=
      larger * games(perGroup + 1) + (group.numGroups - larger) * games(perGroup);
  }
  if (entrants >= 2) {
    if (config.knockout.type === 'DOUBLE_ELIM') {
      totalMatches += 2 * entrants - 2;
    } else {
      const thirdPlaceReal =
        !!config.knockout.thirdPlaceMatch &&
        (bracketSize >= 8 || (bracketSize === 4 && entrants === 4));
      totalMatches += entrants - 1 + (thirdPlaceReal ? 1 : 0);
    }
  }

  // Sequential rounds ("steps"): matches that can run in parallel count as one.
  let sequentialSteps = 0;
  if (group && group.numGroups >= 1) {
    const perGroup = Math.floor(playerCount / group.numGroups);
    const remainder = playerCount % group.numGroups;
    // Round-robin of n players needs n-1 rounds (even) or n rounds (odd).
    const rrRounds = (n: number) => (n < 2 ? 0 : n % 2 === 0 ? n - 1 : n);
    sequentialSteps +=
      remainder > 0
        ? Math.max(rrRounds(perGroup), rrRounds(perGroup + 1))
        : rrRounds(perGroup);
  }
  if (entrants >= 2) {
    const rounds = Math.round(Math.log2(bracketSize));
    sequentialSteps +=
      config.knockout.type === 'DOUBLE_ELIM'
        ? 2 * rounds + (config.knockout.grandFinalReset ? 1 : 0)
        : rounds;
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    knockout: { entrants, bracketSize, byes },
    totalMatches,
    sequentialSteps,
  };
}
