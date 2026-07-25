import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Config, GroupStageConfig, Player, Tournament } from '../engine/types';
import { validateSetup } from '../engine/validation';
import type { SetupValidation } from '../engine/validation';
import { createId } from '../lib/id';

const STORAGE_KEY = 'tbg-storage';
const STORAGE_VERSION = 1;

/** Sensible defaults for a freshly created tournament (edited in the wizard). */
export function defaultConfig(): Config {
  return {
    groupStage: null,
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

function nowIso(): string {
  return new Date().toISOString();
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
  renameTournament: (id: string, name: string) => void;
  /** Validate and, if valid, move a DRAFT tournament to RUNNING. */
  launchTournament: (id: string) => SetupValidation;

  // DRAFT-only editing
  addPlayer: (id: string, name: string) => void;
  addPlayers: (id: string, names: string[]) => void;
  renamePlayer: (id: string, playerId: string, name: string) => void;
  removePlayer: (id: string, playerId: string) => void;
  reorderPlayers: (id: string, orderedIds: string[]) => void;
  movePlayer: (id: string, playerId: string, direction: -1 | 1) => void;
  shufflePlayers: (id: string) => void;
  updateConfig: (id: string, patch: Partial<Config>) => void;
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

        renameTournament: (id, name) => update(id, (t) => ({ ...t, name })),

        launchTournament: (id) => {
          const tournament = get().tournaments.find((t) => t.id === id);
          const validation = tournament
            ? validateSetup(tournament.players, tournament.config)
            : {
                ok: false,
                errors: ['Tournament not found.'],
                warnings: [],
                knockout: { entrants: 0, bracketSize: 0, byes: 0 },
              };
          if (tournament && tournament.status === 'DRAFT' && validation.ok) {
            // NOTE: bracket/group structure generation is wired in a later
            // milestone; for now launching just flips the status.
            update(id, (t) => ({ ...t, status: 'RUNNING' }));
          }
          return validation;
        },

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
            // Keep any players not present in orderedIds (defensive).
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
          updateDraft(id, (t) => {
            const players = [...t.players];
            for (let i = players.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [players[i], players[j]] = [players[j], players[i]];
            }
            return { ...t, players };
          }),

        updateConfig: (id, patch) =>
          updateDraft(id, (t) => ({ ...t, config: { ...t.config, ...patch } })),
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
