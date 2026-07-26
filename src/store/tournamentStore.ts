import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Config,
  GroupStageConfig,
  MatchResult,
  Player,
  Slot,
  SwissConfig,
  Tournament,
} from '../engine/types';
import { validateSetup } from '../engine/validation';
import type { SetupValidation } from '../engine/validation';
import { resolve } from '../engine/resolve';
import { buildSingleEliminationFromEntrants } from '../engine/formats/singleElimination';
import { buildDoubleEliminationFromEntrants } from '../engine/formats/doubleElimination';
import { generateGroupStage, knockoutSeedSlots } from '../engine/formats/groupStage';
import { swissSeedSlots } from '../engine/formats/swiss';
import { createId } from '../lib/id';

const STORAGE_KEY = 'tbg-storage';
const STORAGE_VERSION = 1;

/** Sensible defaults for a freshly created tournament (edited in the wizard). */
export function defaultConfig(): Config {
  return {
    groupStage: null,
    swiss: null,
    knockout: { type: 'SINGLE_ELIM', thirdPlaceMatch: false, grandFinalReset: false },
    seeding: 'RANDOM',
    scoreMode: 'WIN_LOSS',
  };
}

/** Defaults applied when the group stage is switched on in the wizard. */
export function defaultGroupStage(): GroupStageConfig {
  return {
    numGroups: 2,
    advancePerGroup: 2,
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['HEAD_TO_HEAD', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'WINS', 'MANUAL'],
  };
}

/** Defaults applied when the Swiss stage is switched on in the wizard. */
export function defaultSwiss(): SwissConfig {
  return {
    rounds: 3,
    advance: 4,
    points: { win: 3, draw: 1, loss: 0 },
  };
}

export interface RecordResultInput {
  /** Winner's player id; null only records a draw (group phase). */
  winnerId: string | null;
  scoreA?: number | null;
  scoreB?: number | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Return a shuffled copy of an array (Fisher–Yates). */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Drop results that `resolve()` no longer accepts as valid — i.e. stale results
 * whose match participants changed after an upstream edit. resolve() attaches
 * the exact stored object to a match only when it is still valid, so identity
 * comparison is enough.
 */
function pruneResults(tournament: Tournament): Record<string, MatchResult> {
  const derived = resolve(tournament);
  const kept: Record<string, MatchResult> = {};
  for (const [matchId, result] of Object.entries(tournament.results)) {
    if (derived.byId[matchId]?.result === result) kept[matchId] = result;
  }
  return kept;
}

/**
 * Generate the persisted structure for a launched tournament. The first stage is
 * an optional group stage or Swiss stage; it may feed a single- or double-
 * elimination knockout (or, for Swiss, stand alone). Group matches are built up
 * front; Swiss rounds are derived live by `resolve()`, so only the seed order is
 * persisted here (plus the knockout, whose entrants are filled in later).
 */
function buildStructure(
  tournament: Tournament,
): Pick<Tournament, 'players' | 'groups' | 'matches'> {
  const { config, players } = tournament;
  const seeded = config.seeding === 'RANDOM' ? shuffle(players) : [...players];

  let groups: Tournament['groups'] = [];
  let groupMatches: Tournament['matches'] = [];
  let entrants: Slot[];

  if (config.groupStage) {
    const generated = generateGroupStage(seeded, config.groupStage.numGroups);
    groups = generated.groups;
    groupMatches = generated.matches;
    entrants = knockoutSeedSlots(groups, config.groupStage.advancePerGroup);
  } else if (config.swiss) {
    // Swiss rounds are generated on the fly from results by resolve(); the
    // knockout (if any) is seeded from the final Swiss standings.
    entrants = swissSeedSlots(config.swiss.advance);
  } else {
    entrants = seeded.map((p) => ({ kind: 'PLAYER', playerId: p.id }));
  }

  let knockout: Tournament['matches'] = [];
  if (config.knockout.type === 'SINGLE_ELIM') {
    knockout = buildSingleEliminationFromEntrants(entrants, {
      thirdPlaceMatch: config.knockout.thirdPlaceMatch,
    });
  } else if (config.knockout.type === 'DOUBLE_ELIM') {
    knockout = buildDoubleEliminationFromEntrants(entrants, {
      grandFinalReset: config.knockout.grandFinalReset,
    });
  }

  return { players: seeded, groups, matches: [...groupMatches, ...knockout] };
}

function statusAfterResults(tournament: Tournament): Tournament['status'] {
  return resolve(tournament).isComplete ? 'COMPLETED' : 'RUNNING';
}

function newTournament(name: string): Tournament {
  const timestamp = nowIso();
  return {
    id: createId(),
    name: name.trim() || 'Untitled tournament',
    status: 'DRAFT',
    config: defaultConfig(),
    players: [],
    groups: [],
    matches: [],
    results: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

interface TournamentState {
  tournaments: Tournament[];

  // Lifecycle
  createTournament: (name: string) => string;
  deleteTournament: (id: string) => void;
  duplicateTournament: (id: string) => string | null;
  /** Add an imported tournament (deep-copied) with a fresh id. Returns the id. */
  importTournament: (data: Tournament) => string;
  renameTournament: (id: string, name: string) => void;
  /** Validate and, if valid, generate the structure and move DRAFT → RUNNING. */
  launchTournament: (id: string) => SetupValidation;
  /** Return a tournament to DRAFT, clearing its structure and results. */
  resetTournament: (id: string) => void;

  // DRAFT-only editing
  addPlayer: (id: string, name: string) => void;
  addPlayers: (id: string, names: string[]) => void;
  renamePlayer: (id: string, playerId: string, name: string) => void;
  removePlayer: (id: string, playerId: string) => void;
  reorderPlayers: (id: string, orderedIds: string[]) => void;
  movePlayer: (id: string, playerId: string, direction: -1 | 1) => void;
  shufflePlayers: (id: string) => void;
  updateConfig: (id: string, patch: Partial<Config>) => void;

  // RUNNING editing
  recordResult: (id: string, matchId: string, input: RecordResultInput) => void;
  clearResult: (id: string, matchId: string) => void;
  /** How many other recorded results this change would invalidate (for edit warnings). */
  previewResultImpact: (id: string, matchId: string, input: RecordResultInput) => number;
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => {
      /** Apply a change to one tournament, bumping its updatedAt. */
      const update = (id: string, change: (t: Tournament) => Tournament) =>
        set((state) => ({
          tournaments: state.tournaments.map((t) =>
            t.id === id ? { ...change(t), updatedAt: nowIso() } : t,
          ),
        }));

      /** Like `update`, but only for DRAFT tournaments (post-launch immutability). */
      const updateDraft = (id: string, change: (t: Tournament) => Tournament) =>
        set((state) => ({
          tournaments: state.tournaments.map((t) =>
            t.id === id && t.status === 'DRAFT'
              ? { ...change(t), updatedAt: nowIso() }
              : t,
          ),
        }));

      return {
        tournaments: [],

        createTournament: (name) => {
          const tournament = newTournament(name);
          set((state) => ({ tournaments: [tournament, ...state.tournaments] }));
          return tournament.id;
        },

        deleteTournament: (id) =>
          set((state) => ({
            tournaments: state.tournaments.filter((t) => t.id !== id),
          })),

        duplicateTournament: (id) => {
          const source = get().tournaments.find((t) => t.id === id);
          if (!source) return null;
          const timestamp = nowIso();
          const copy: Tournament = {
            ...structuredClone(source),
            id: createId(),
            name: `${source.name} (copy)`,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          set((state) => ({ tournaments: [copy, ...state.tournaments] }));
          return copy.id;
        },

        importTournament: (data) => {
          const imported: Tournament = {
            ...structuredClone(data),
            id: createId(),
            updatedAt: nowIso(),
          };
          set((state) => ({ tournaments: [imported, ...state.tournaments] }));
          return imported.id;
        },

        renameTournament: (id, name) => update(id, (t) => ({ ...t, name })),

        launchTournament: (id) => {
          const tournament = get().tournaments.find((t) => t.id === id);
          const validation: SetupValidation = tournament
            ? validateSetup(tournament.players, tournament.config)
            : {
                ok: false,
                errors: ['Tournament not found.'],
                warnings: [],
                knockout: { entrants: 0, bracketSize: 0, byes: 0 },
                totalMatches: 0,
                sequentialSteps: 0,
              };
          if (tournament && tournament.status === 'DRAFT' && validation.ok) {
            update(id, (t) => ({
              ...t,
              ...buildStructure(t),
              results: {},
              status: 'RUNNING',
            }));
          }
          return validation;
        },

        resetTournament: (id) =>
          update(id, (t) => ({
            ...t,
            status: 'DRAFT',
            groups: [],
            matches: [],
            results: {},
          })),

        addPlayer: (id, name) =>
          updateDraft(id, (t) => ({
            ...t,
            players: [...t.players, { id: createId(), name: name.trim() }],
          })),

        addPlayers: (id, names) =>
          updateDraft(id, (t) => ({
            ...t,
            players: [
              ...t.players,
              ...names
                .map((n) => n.trim())
                .filter((n) => n.length > 0)
                .map((n) => ({ id: createId(), name: n })),
            ],
          })),

        renamePlayer: (id, playerId, name) =>
          updateDraft(id, (t) => ({
            ...t,
            players: t.players.map((p) => (p.id === playerId ? { ...p, name } : p)),
          })),

        removePlayer: (id, playerId) =>
          updateDraft(id, (t) => ({
            ...t,
            players: t.players.filter((p) => p.id !== playerId),
          })),

        reorderPlayers: (id, orderedIds) =>
          updateDraft(id, (t) => {
            const byId = new Map(t.players.map((p) => [p.id, p]));
            const reordered = orderedIds
              .map((pid) => byId.get(pid))
              .filter((p): p is Player => Boolean(p));
            const missing = t.players.filter((p) => !orderedIds.includes(p.id));
            return { ...t, players: [...reordered, ...missing] };
          }),

        movePlayer: (id, playerId, direction) =>
          updateDraft(id, (t) => {
            const index = t.players.findIndex((p) => p.id === playerId);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= t.players.length) return t;
            const players = [...t.players];
            [players[index], players[target]] = [players[target], players[index]];
            return { ...t, players };
          }),

        shufflePlayers: (id) =>
          updateDraft(id, (t) => ({ ...t, players: shuffle(t.players) })),

        updateConfig: (id, patch) =>
          updateDraft(id, (t) => ({ ...t, config: { ...t.config, ...patch } })),

        recordResult: (id, matchId, input) =>
          update(id, (t) => {
            if (t.status !== 'RUNNING' && t.status !== 'COMPLETED') return t;
            const resolved = resolve(t).byId[matchId];
            if (
              !resolved ||
              resolved.sideA.kind !== 'PLAYER' ||
              resolved.sideB.kind !== 'PLAYER'
            ) {
              return t;
            }
            const result: MatchResult = {
              sideAPlayerId: resolved.sideA.playerId,
              sideBPlayerId: resolved.sideB.playerId,
              scoreA: input.scoreA ?? null,
              scoreB: input.scoreB ?? null,
              winnerId: input.winnerId,
            };
            const next: Tournament = {
              ...t,
              results: { ...t.results, [matchId]: result },
            };
            next.results = pruneResults(next);
            return { ...next, status: statusAfterResults(next) };
          }),

        clearResult: (id, matchId) =>
          update(id, (t) => {
            if (t.status !== 'RUNNING' && t.status !== 'COMPLETED') return t;
            const results = { ...t.results };
            delete results[matchId];
            const next: Tournament = { ...t, results };
            next.results = pruneResults(next);
            return { ...next, status: statusAfterResults(next) };
          }),

        previewResultImpact: (id, matchId, input) => {
          const tournament = get().tournaments.find((t) => t.id === id);
          if (!tournament) return 0;
          const resolved = resolve(tournament).byId[matchId];
          if (
            !resolved ||
            resolved.sideA.kind !== 'PLAYER' ||
            resolved.sideB.kind !== 'PLAYER'
          ) {
            return 0;
          }
          const simulated: Tournament = {
            ...tournament,
            results: {
              ...tournament.results,
              [matchId]: {
                sideAPlayerId: resolved.sideA.playerId,
                sideBPlayerId: resolved.sideB.playerId,
                scoreA: input.scoreA ?? null,
                scoreB: input.scoreB ?? null,
                winnerId: input.winnerId,
              },
            },
          };
          const pruned = pruneResults(simulated);
          let affected = 0;
          for (const key of Object.keys(tournament.results)) {
            if (key !== matchId && !(key in pruned)) affected += 1;
          }
          return affected;
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // When the persisted shape changes in a future release, bump
      // STORAGE_VERSION and translate older state here.
      migrate: (persistedState) => persistedState as TournamentState,
    },
  ),
);
