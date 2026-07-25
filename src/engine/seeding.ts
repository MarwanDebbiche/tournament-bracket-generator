/**
 * Standard single-elimination seeding order for a bracket of `size` slots
 * (`size` must be a power of two).
 *
 * Returns an array of 1-based seed numbers indexed by bracket slot. Adjacent
 * pairs — slots (0,1), (2,3), … — are the first-round matchups, arranged so the
 * top seeds are spread across the bracket and can only meet in later rounds
 * (seeds 1 and 2 meet at the earliest in the final).
 *
 * Examples:
 *   seedOrder(2) → [1, 2]
 *   seedOrder(4) → [1, 4, 2, 3]
 *   seedOrder(8) → [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function seedOrder(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) {
    throw new Error(`Bracket size must be a power of two, got ${size}`);
  }
  let seeds = [1];
  while (seeds.length < size) {
    const total = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const seed of seeds) {
      next.push(seed);
      next.push(total - seed);
    }
    seeds = next;
  }
  return seeds;
}
