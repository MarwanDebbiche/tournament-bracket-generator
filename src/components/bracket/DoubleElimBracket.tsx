import type { ReactNode } from 'react';
import type { DerivedState, ResolvedMatch } from '../../engine/resolve';
import { MatchCard } from './MatchCard';

type SelectFn = (matchId: string) => void;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Column({
  title,
  matches,
  nameOf,
  onSelectMatch,
}: {
  title: string;
  matches: ResolvedMatch[];
  nameOf: (id: string) => string;
  onSelectMatch: SelectFn;
}) {
  return (
    <div className="flex min-w-[200px] flex-col">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </div>
      <div className="flex flex-1 flex-col justify-around gap-4">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} nameOf={nameOf} onSelect={onSelectMatch} />
        ))}
      </div>
    </div>
  );
}

function byRound(matches: ResolvedMatch[]): Array<[number, ResolvedMatch[]]> {
  const map = new Map<number, ResolvedMatch[]>();
  for (const m of matches) {
    const list = map.get(m.match.round) ?? [];
    list.push(m);
    map.set(m.match.round, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, list]) => [
      round,
      list.sort((a, b) => a.match.order - b.match.order),
    ]);
}

export function DoubleElimBracket({
  derived,
  nameOf,
  onSelectMatch,
}: {
  derived: DerivedState;
  nameOf: (id: string) => string;
  onSelectMatch: SelectFn;
}) {
  const winners = byRound(derived.matches.filter((m) => m.match.phase === 'WINNERS'));
  const losers = byRound(derived.matches.filter((m) => m.match.phase === 'LOSERS'));
  const grandFinals = derived.matches
    .filter((m) => m.match.phase === 'GRAND_FINAL' && !m.skipped)
    .sort((a, b) => a.match.round - b.match.round);

  const wbLabel = (index: number) =>
    index === winners.length - 1 ? 'Winners final' : `Winners R${index + 1}`;
  const lbLabel = (index: number) =>
    index === losers.length - 1 ? 'Losers final' : `Losers R${index + 1}`;

  return (
    <div className="space-y-8">
      <Section title="Winners bracket">
        <div className="flex items-stretch gap-6 overflow-x-auto pb-2">
          {winners.map(([round, matches], i) => (
            <Column
              key={round}
              title={wbLabel(i)}
              matches={matches}
              nameOf={nameOf}
              onSelectMatch={onSelectMatch}
            />
          ))}
        </div>
      </Section>

      {losers.length > 0 && (
        <Section title="Losers bracket">
          <div className="flex items-stretch gap-6 overflow-x-auto pb-2">
            {losers.map(([round, matches], i) => (
              <Column
                key={round}
                title={lbLabel(i)}
                matches={matches}
                nameOf={nameOf}
                onSelectMatch={onSelectMatch}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Grand final">
        <div className="flex gap-6">
          {grandFinals.map((m) => (
            <Column
              key={m.id}
              title={m.match.round === 1 ? 'Reset' : 'Decider'}
              matches={[m]}
              nameOf={nameOf}
              onSelectMatch={onSelectMatch}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
