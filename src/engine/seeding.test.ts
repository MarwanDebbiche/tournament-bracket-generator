import { describe, expect, it } from 'vitest';
import { seedOrder } from './seeding';

describe('seedOrder', () => {
  it('matches known orderings', () => {
    expect(seedOrder(1)).toEqual([1]);
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ]);
  });

  it('is a permutation of 1..size', () => {
    for (const size of [2, 4, 8, 16, 32]) {
      const order = seedOrder(size);
      expect(order).toHaveLength(size);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: size }, (_, i) => i + 1),
      );
    }
  });

  it('every first-round pair sums to size + 1', () => {
    for (const size of [2, 4, 8, 16]) {
      const order = seedOrder(size);
      for (let i = 0; i < order.length; i += 2) {
        expect(order[i] + order[i + 1]).toBe(size + 1);
      }
    }
  });

  it('keeps the top two seeds in opposite halves', () => {
    for (const size of [4, 8, 16, 32]) {
      const order = seedOrder(size);
      const half = size / 2;
      expect(order.indexOf(1)).toBeLessThan(half);
      expect(order.indexOf(2)).toBeGreaterThanOrEqual(half);
    }
  });

  it('rejects non-power-of-two sizes', () => {
    expect(() => seedOrder(3)).toThrow();
    expect(() => seedOrder(0)).toThrow();
  });
});
