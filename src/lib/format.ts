import type { Config } from '../engine/types';

/** Human-readable one-line description of a tournament's format. */
export function formatLabel(config: Config): string {
  const firstStage = config.groupStage ? 'Groups' : config.swiss ? 'Swiss' : null;
  const knockout =
    config.knockout.type === 'DOUBLE_ELIM'
      ? 'Double elimination'
      : config.knockout.type === 'SINGLE_ELIM'
        ? 'Single elimination'
        : null;
  if (firstStage && knockout) return `${firstStage} → ${knockout}`;
  if (firstStage) return firstStage === 'Swiss' ? 'Swiss system' : firstStage;
  return knockout ?? 'Tournament';
}

/** Format an ISO timestamp as a short, locale-aware date. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
