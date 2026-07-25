import { Check } from 'lucide-react';
import type { DerivedState } from '../../engine/resolve';
import type { Tournament } from '../../engine/types';
import { cn } from '../../lib/cn';
import { MatchCard } from '../bracket/MatchCard';
import { GroupStandings } from './GroupStandings';

export function GroupStageView({
  tournament,
  derived,
  nameOf,
  onSelectMatch,
}: {
  tournament: Tournament;
  derived: DerivedState;
  nameOf: (id: string) => string;
  onSelectMatch: (matchId: string) => void;
}) {
  const advancePerGroup = tournament.config.groupStage?.advancePerGroup ?? 1;
  const { scoreMode } = tournament.config;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {tournament.groups.map((group) => {
        const rows = derived.standings[group.id] ?? [];
        const complete = derived.groupsComplete[group.id];
        const groupMatches = derived.matches
          .filter((m) => m.match.groupId === group.id)
          .sort(
            (a, b) =>
              a.match.round - b.match.round || a.match.order - b.match.order,
          );
        const played = groupMatches.filter((m) => m.status === 'DONE').length;

        return (
          <section
            key={group.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {group.name}
              </h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  complete
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {complete && <Check className="h-3.5 w-3.5" aria-hidden />}
                {played}/{groupMatches.length} played
              </span>
            </div>

            <div className="mt-3">
              <GroupStandings
                rows={rows}
                scoreMode={scoreMode}
                advancePerGroup={advancePerGroup}
                nameOf={nameOf}
              />
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Matches
              </div>
              <div className="space-y-2">
                {groupMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    nameOf={nameOf}
                    onSelect={onSelectMatch}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
