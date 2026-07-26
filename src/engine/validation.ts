import type { Config, Player } from './types';

/** Smallest power of two that is >= n (0 for n < 1). */
export function nextPowerOfTwo(n: number): number {
  if (n < 1) return 0;
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

export interface KnockoutInfo {
  /** Players/qualifiers entering the elimination stage (0 when there is none). */
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
   * Number of real matches that will actually be contested — group/Swiss games
   * plus knockout games, excluding byes/walkovers and the conditional grand-final
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

  const playerCount = players.length;
  const group = config.groupStage;
  const swiss = config.swiss;
  const type = config.knockout.type;
  const hasKnockout = type !== 'NONE';

  // Format sanity: exactly one first stage, and something must decide a winner.
  if (group && swiss) {
    errors.push('Choose either a group stage or a Swiss stage, not both.');
  }
  if (!hasKnockout && !swiss) {
    errors.push(
      'Choose a knockout format (only a Swiss stage can decide a winner on its own).',
    );
  }

  if (playerCount < 2) {
    errors.push('At least 2 players are needed to run a tournament.');
  }

  // Players entering the knockout stage.
  let entrants = 0;

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
  } else if (swiss) {
    if (swiss.rounds < 1) {
      errors.push('The Swiss stage needs at least 1 round.');
    } else if (playerCount >= 2 && swiss.rounds > playerCount - 1) {
      errors.push(
        `${playerCount} players can play at most ${playerCount - 1} Swiss rounds.`,
      );
    }

    if (hasKnockout) {
      if (swiss.advance < 2) {
        errors.push('At least 2 players must advance to the knockout.');
      } else if (swiss.advance > playerCount) {
        errors.push(`Can't advance ${swiss.advance} players from ${playerCount}.`);
      } else if (swiss.advance === playerCount && playerCount >= 2) {
        warnings.push('Every player advances — the Swiss stage only seeds the knockout.');
      }
      entrants = swiss.advance;
    }
  } else {
    entrants = playerCount;
  }

  if (group && hasKnockout && entrants < 2 && playerCount >= 2) {
    errors.push('At least 2 players must reach the knockout stage.');
  }

  // Double elimination with 2 entrants collapses to a single final.
  if (type === 'DOUBLE_ELIM' && entrants === 2) {
    warnings.push('With 2 entrants, double elimination is just a single final.');
  }

  // Seeding from group standings requires a group stage.
  if (config.seeding === 'GROUP_STANDING' && !group) {
    errors.push('Group-standing seeding requires a group stage.');
  }

  const bracketSize = hasKnockout && entrants >= 2 ? nextPowerOfTwo(entrants) : 0;
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
  if (swiss && swiss.rounds >= 1 && playerCount >= 2) {
    // Each round pairs the field; an odd player out gets a (uncounted) bye.
    totalMatches += swiss.rounds * Math.floor(playerCount / 2);
  }
  if (hasKnockout && entrants >= 2) {
    if (type === 'DOUBLE_ELIM') {
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
  if (swiss && swiss.rounds >= 1 && playerCount >= 2) {
    sequentialSteps += swiss.rounds;
  }
  if (hasKnockout && entrants >= 2) {
    const rounds = Math.round(Math.log2(bracketSize));
    sequentialSteps +=
      type === 'DOUBLE_ELIM'
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
