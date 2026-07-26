import { describe, expect, it } from 'vitest';
import { generateDoubleElimination } from './doubleElimination';
import type { DropIndex } from './doubleElimination';
import { resolve } from '../resolve';
import type { Tournament } from '../types';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Play a full double-elimination with random results and count losers-bracket
 * matches that repeat a winners-bracket pairing, split by whether they happen
 * in the very first major LB round vs anywhere before the LB final.
 */
function countRematches(n: number, sims: number, dropIndex?: DropIndex) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
  const structure = generateDoubleElimination(players, dropIndex ? { dropIndex } : {});
  const lbFinalRound = Math.max(
    ...structure.filter((m) => m.phase === 'LOSERS').map((m) => m.round),
  );
  const key = (x: string, y: string) => [x, y].sort().join('|');
  const rand = lcg(2024 + n);
  let firstMajor = 0;
  let preFinal = 0;

  for (let sim = 0; sim < sims; sim++) {
    const t: Tournament = {
      id: 't', name: 't', status: 'RUNNING',
      config: { groupStage: null, swiss: null, knockout: { type: 'DOUBLE_ELIM' }, seeding: 'MANUAL', scoreMode: 'WIN_LOSS' },
      players, groups: [], matches: structure, results: {}, createdAt: '', updatedAt: '',
    };
    let guard = 0;
    while (guard++ < 5000) {
      const d = resolve(t);
      if (d.isComplete) break;
      const ready = d.matches.filter((m) => m.status === 'READY');
      if (!ready.length) break;
      for (const m of ready) {
        if (m.sideA.kind !== 'PLAYER' || m.sideB.kind !== 'PLAYER') continue;
        const a = m.sideA.playerId, b = m.sideB.playerId;
        t.results[m.id] = { sideAPlayerId: a, sideBPlayerId: b, scoreA: null, scoreB: null, winnerId: rand() < 0.5 ? a : b };
      }
    }
    const d = resolve(t);
    const wb = new Set<string>();
    for (const m of d.matches) {
      if (m.result && m.match.phase === 'WINNERS') wb.add(key(m.result.sideAPlayerId, m.result.sideBPlayerId));
    }
    for (const m of d.matches) {
      if (!m.result || m.match.phase !== 'LOSERS') continue;
      if (!wb.has(key(m.result.sideAPlayerId, m.result.sideBPlayerId))) continue;
      if (m.match.round === 1) firstMajor++;
      if (m.match.round < lbFinalRound) preFinal++;
    }
  }
  return { firstMajor, preFinal };
}

describe('double elimination — losers-bracket rematch avoidance', () => {
  it('never rematches a winners-bracket pairing in the first losers-bracket round', () => {
    for (const n of [8, 16, 32]) {
      expect(countRematches(n, 150).firstMajor).toBe(0);
    }
  });

  it('has fewer pre-final rematches than a plain reversal', () => {
    const reversal: DropIndex = (slot, count) => count - 1 - slot;
    for (const n of [16, 32]) {
      const withDefault = countRematches(n, 150).preFinal;
      const withReversal = countRematches(n, 150, reversal).preFinal;
      expect(withDefault).toBeLessThan(withReversal);
    }
  });
});
