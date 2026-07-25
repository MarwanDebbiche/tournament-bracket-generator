import type { Tournament } from '../engine/types';

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tournament'
  );
}

/** Trigger a download of the tournament as a pretty-printed JSON file. */
export function downloadTournamentJson(tournament: Tournament): void {
  const blob = new Blob([JSON.stringify(tournament, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(tournament.name)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function isTournamentLike(data: unknown): data is Tournament {
  if (!data || typeof data !== 'object') return false;
  const t = data as Record<string, unknown>;
  return (
    typeof t.name === 'string' &&
    typeof t.status === 'string' &&
    typeof t.config === 'object' &&
    t.config !== null &&
    Array.isArray(t.players) &&
    Array.isArray(t.groups) &&
    Array.isArray(t.matches) &&
    typeof t.results === 'object' &&
    t.results !== null
  );
}

/** Parse tournament JSON, returning null if it isn't a valid tournament file. */
export function parseTournamentFile(text: string): Tournament | null {
  try {
    const data: unknown = JSON.parse(text);
    return isTournamentLike(data) ? data : null;
  } catch {
    return null;
  }
}
