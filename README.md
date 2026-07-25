# Tournament Bracket Generator

A frontend-only web app for configuring and running tournaments. Create a
tournament, add players, pick a format, launch it, then enter results as the app
progressively unlocks the next matches. Everything is saved in your browser via
`localStorage` — no backend, no accounts.

## Formats

Every tournament ends in an **elimination stage** that decides the winner, with an
**optional group stage** before it:

- **Group stage** (optional) — players are split into groups and play round-robin
  within each group; the top *N* of each group qualify for the elimination stage.
- **Single elimination** — lose once and you are out.
- **Double elimination** — a winners bracket and a losers bracket; you are out
  after two losses.

Fields that are not a power of two are handled with **byes**, and draws are allowed
only in group matches.

## Tech stack

- React 19 + TypeScript (strict)
- Vite 6
- Tailwind CSS v4
- Zustand — state, persisted to `localStorage` via the `persist` middleware
- React Router
- Vitest + Testing Library

## Getting started

Requires Node 20+ (developed on Node 24).

```bash
npm install     # install dependencies
npm run dev     # start the dev server at http://localhost:5173
npm run build   # typecheck + production build
npm test        # run the test suite
```

## Project structure

```
src/
  engine/      # pure, framework-free tournament logic + domain types
  store/       # Zustand store, persisted to localStorage
  pages/       # Home, Setup, and Tournament screens
  lib/         # small helpers (ids, formatting)
  components/  # UI, added as milestones land
```

The design keeps a pure **engine** (bracket generation, standings, result
progression) fully separate from React. Once a tournament is launched its structure
is frozen and the results map is the only mutable state; everything else — who
occupies each slot, the standings, the champion — is derived by a pure function.
This keeps the logic exhaustively unit-testable and avoids bracket-corruption bugs.

## Status

Early development. The project scaffold, `localStorage` persistence, and the home
screen (create / list / duplicate / delete tournaments) are in place. The setup
wizard, the tournament engine, and bracket rendering are in progress.
