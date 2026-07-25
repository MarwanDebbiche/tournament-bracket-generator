import type { Config } from '../engine/types';

/** Human-readable one-line description of a tournament's format. */
export function formatLabel(config: Config): string {
  const knockout =
    config.knockout.type === 'DOUBLE_ELIM'
      ? 'Double elimination'
      : 'Single elimination';
  return config.groupStage ? `Groups → ${knockout}` : knockout;
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
