import { Check } from 'lucide-react';
import type { DerivedState, ResolvedMatch } from '../../engine/resolve';
import type { SwissStandingRow } from '../../engine/formats/swiss';
import type { Tournament } from '../../engine/types';
import { cn } from '../../lib/cn';
import { MatchCard } from '../bracket/MatchCard';

export function SwissView({
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
  const { swiss, knockout } = tournament.config;
  const advance = swiss && knockout.type !== 'NONE' ? swiss.advance : 0;

  const swissMatches = derived.matches
    .filter((m) => m.match.phase === 'SWISS')
    .sort((a, b) => a.match.round - b.match.round || a.match.order - b.match.order);

  const rounds: { round: number; matches: ResolvedMatch[] }[] = [];
  for (const m of swissMatches) {
    const last = rounds[rounds.length - 1];
    if (last && last.round === m.match.round) last.matches.push(m);
    else rounds.push({ round: m.match.round, matches: [m] });
  }

  const totalRounds = swiss?.rounds ?? rounds.length;
  const roundsDone = rounds.filter((r) =>
    r.matches.every((m) => m.status === 'DONE'),
  ).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Standings
          </h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              derived.swissComplete
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {derived.swissComplete && <Check className="h-3.5 w-3.5" aria-hidden />}
            {roundsDone}/{totalRounds} rounds
          </span>
        </div>
        <div className="mt-3">
          <SwissStandings
            rows={derived.swissStandings}
            advance={advance}
            nameOf={nameOf}
          />
        </div>
        {advance > 0 && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            The top {advance} advance to the knockout.
          </p>
        )}
      </section>

      <section className="space-y-4">
        {rounds.map(({ round, matches }) => (
          <div key={round}>
            <div className="mb-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
              Round {round + 1}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  nameOf={nameOf}
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function SwissStandings({
  rows,
  advance,
  nameOf,
}: {
  rows: SwissStandingRow[];
  advance: number;
  nameOf: (id: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 dark:text-slate-500">
            <th className="w-6 py-1 text-right font-medium">#</th>
            <th className="py-1 pl-2 text-left font-medium">Player</th>
            <Stat label="P" title="Played" />
            <Stat label="W" title="Won" />
            <Stat label="D" title="Drawn" />
            <Stat label="L" title="Lost" />
            <Stat label="BH" title="Buchholz (opponents' combined score)" />
            <th className="px-1.5 py-1 text-right font-semibold text-slate-500 dark:text-slate-400">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const qualifies = advance > 0 && i < advance;
            return (
              <tr
                key={row.playerId}
                className={cn(
                  'border-t border-slate-100 dark:border-slate-800',
                  qualifies && 'bg-emerald-50/50 dark:bg-emerald-500/10',
                )}
              >
                <td
                  className={cn(
                    'py-1.5 text-right tabular-nums',
                    qualifies
                      ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  {i + 1}
                </td>
                <td className="max-w-[10rem] truncate py-1.5 pl-2 font-medium text-slate-800 dark:text-slate-100">
                  {nameOf(row.playerId)}
                </td>
                <Cell value={row.played} muted />
                <Cell value={row.won} />
                <Cell value={row.drawn} />
                <Cell value={row.lost} />
                <Cell value={row.buchholz} muted />
                <td className="px-1.5 py-1.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, title }: { label: string; title: string }) {
  return (
    <th className="px-1.5 py-1 text-right font-medium" title={title}>
      {label}
    </th>
  );
}

function Cell({ value, muted }: { value: number; muted?: boolean }) {
  return (
    <td
      className={cn(
        'px-1.5 py-1.5 text-right tabular-nums',
        muted
          ? 'text-slate-400 dark:text-slate-500'
          : 'text-slate-600 dark:text-slate-300',
      )}
    >
      {value}
    </td>
  );
}
