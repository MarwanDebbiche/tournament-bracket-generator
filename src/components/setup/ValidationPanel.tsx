import { AlertTriangle, CircleAlert, Info } from 'lucide-react';
import type { SetupValidation } from '../../engine/validation';

export default function ValidationPanel({
  validation,
}: {
  validation: SetupValidation;
}) {
  const { errors, warnings, knockout, totalMatches, sequentialSteps } = validation;

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
          <ul className="space-y-1">
            {errors.map((message) => (
              <li
                key={message}
                className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <ul className="space-y-1">
            {warnings.map((message) => (
              <li
                key={message}
                className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {knockout.entrants >= 2 && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
          <span>
            {knockout.entrants} entrant{knockout.entrants === 1 ? '' : 's'} →{' '}
            {knockout.bracketSize}-slot bracket
            {knockout.byes > 0
              ? ` · ${knockout.byes} bye${knockout.byes === 1 ? '' : 's'}`
              : ''}
            {' · '}
            {totalMatches} match{totalMatches === 1 ? '' : 'es'} to play
            {' · '}
            <span title="Rounds of matches that can be played in parallel — a rough sense of how long the tournament takes">
              {sequentialSteps} round{sequentialSteps === 1 ? '' : 's'}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
