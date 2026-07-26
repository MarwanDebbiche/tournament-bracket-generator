import type { Group, Match, Player, Slot } from '../types';
import { roundRobinSchedule } from '../roundRobin';

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function groupName(index: number): string {
  return index < GROUP_LETTERS.length
    ? `Group ${GROUP_LETTERS[index]}`
    : `Group ${index + 1}`;
}

/**
 * Distribute seed-ordered players into groups serpentine (snake) so each group
 * gets a balanced spread of seeds: A,B,C,C,B,A,A,B,C,…
 */
export function distributeIntoGroups(
  players: Player[],
  numGroups: number,
): Player[][] {
  const groups: Player[][] = Array.from({ length: numGroups }, () => []);
  players.forEach((player, i) => {
    const band = Math.floor(i / numGroups);
    const pos = i % numGroups;
    const groupIndex = band % 2 === 0 ? pos : numGroups - 1 - pos;
    groups[groupIndex].push(player);
  });
  return groups;
}

export interface GroupStageStructure {
  groups: Group[];
  matches: Match[];
}

/** Partition players into groups and build each group's round-robin matches. */
export function generateGroupStage(
  players: Player[],
  numGroups: number,
): GroupStageStructure {
  const distribution = distributeIntoGroups(players, numGroups);
  const groups: Group[] = [];
  const matches: Match[] = [];

  distribution.forEach((groupPlayers, groupIndex) => {
    const group: Group = {
      id: `G${groupIndex}`,
      name: groupName(groupIndex),
      playerIds: groupPlayers.map((p) => p.id),
    };
    groups.push(group);

    const perRoundOrder = new Map<number, number>();
    for (const pairing of roundRobinSchedule(groupPlayers.length)) {
      const order = perRoundOrder.get(pairing.round) ?? 0;
      perRoundOrder.set(pairing.round, order + 1);
      matches.push({
        id: `${group.id}-R${pairing.round}-M${order}`,
        phase: 'GROUP',
        round: pairing.round,
        order,
        groupId: group.id,
        slotA: { kind: 'PLAYER', playerId: groupPlayers[pairing.home].id },
        slotB: { kind: 'PLAYER', playerId: groupPlayers[pairing.away].id },
      });
    }
  });

  return { groups, matches };
}

/**
 * Entrant slots for the knockout stage, one per qualifier, in seed order
 * (SEED 1 = the top overall seed). The actual player behind each seed is
 * resolved from group standings once the group stage finishes (best group
 * winner is seed 1, and so on) — see `seedQualifiers` in resolve.
 */
export function knockoutSeedSlots(groups: Group[], advancePerGroup: number): Slot[] {
  const count = groups.length * advancePerGroup;
  return Array.from({ length: count }, (_, i) => ({ kind: 'SEED', seed: i + 1 }));
}
