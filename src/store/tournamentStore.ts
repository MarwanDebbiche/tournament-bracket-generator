import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Config, Tournament } from '../engine/types';
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
  /** Create a DRAFT tournament and return its id. */
  createTournament: (name: string) => string;
  deleteTournament: (id: string) => void;
  /** Deep-copy an existing tournament; returns the new id, or null if not found. */
  duplicateTournament: (id: string) => string | null;
  renameTournament: (id: string, name: string) => void;
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
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

      renameTournament: (id, name) =>
        set((state) => ({
          tournaments: state.tournaments.map((t) =>
            t.id === id ? { ...t, name, updatedAt: nowIso() } : t,
          ),
        })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // When the persisted shape changes in a future release, bump
      // STORAGE_VERSION and translate older state here.
      migrate: (persistedState) => persistedState as TournamentState,
    },
  ),
);
