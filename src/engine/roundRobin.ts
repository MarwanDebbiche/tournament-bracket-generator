export interface Pairing {
  /** 0-based matchday. */
  round: number;
  /** Player indices into the group's roster. */
  home: number;
  away: number;
}

/**
 * Round-robin schedule for `n` players using the circle method: every player
 * meets every other exactly once. For an odd `n`, a dummy sits out each round
 * (that player has a bye — no match generated). Returns pairings grouped by
 * matchday, so `n(n-1)/2` pairings across `n-1` (even) or `n` (odd) rounds.
 */
export function roundRobinSchedule(n: number): Pairing[] {
  if (n < 2) return [];

  const isOdd = n % 2 === 1;
  const size = isOdd ? n + 1 : n; // include a dummy (index === n) when odd
  const dummy = n; // dummy index, only present when isOdd
  const rounds = size - 1;
  const half = size / 2;

  let seats = Array.from({ length: size }, (_, i) => i);
  const pairings: Pairing[] = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = seats[i];
      const away = seats[size - 1 - i];
      if (home !== dummy && away !== dummy) {
        // Alternate home/away by round for a fairer schedule.
        pairings.push(
          round % 2 === 0
            ? { round, home, away }
            : { round, home: away, away: home },
        );
      }
    }
    // Rotate all seats except the first, clockwise.
    seats = [seats[0], seats[size - 1], ...seats.slice(1, size - 1)];
  }

  return pairings;
}
