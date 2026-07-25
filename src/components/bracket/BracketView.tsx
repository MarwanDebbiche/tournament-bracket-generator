import type { DerivedState, ResolvedMatch } from '../../engine/resolve';
import { MatchCard } from './MatchCard';

function roundLabel(matchCount: number): string {
  if (matchCount === 1) return 'Final';
  if (matchCount === 2) return 'Semifinals';
  if (matchCount === 4) return 'Quarterfinals';
  return `Round of ${matchCount * 2}`;
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
  onSelectMatch: (matchId: string) => void;
}) {
  return (
    <div className="flex min-w-[210px] flex-col">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
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

export function BracketView({
  derived,
  nameOf,
  onSelectMatch,
}: {
  derived: DerivedState;
  nameOf: (id: string) => string;
  onSelectMatch: (matchId: string) => void;
}) {
  const winners = derived.matches.filter((m) => m.match.phase === 'WINNERS');

  const byRound = new Map<number, ResolvedMatch[]>();
  for (const m of winners) {
    const list = byRound.get(m.match.round) ?? [];
    list.push(m);
    byRound.set(m.match.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  const thirdPlace = derived.matches.find((m) => m.match.phase === 'THIRD_PLACE');

  return (
    <div className="flex items-stretch gap-6 overflow-x-auto pb-2">
      {rounds.map((round) => {
        const matches = byRound
          .get(round)!
          .sort((a, b) => a.match.order - b.match.order);
        return (
          <Column
            key={round}
            title={roundLabel(matches.length)}
            matches={matches}
            nameOf={nameOf}
            onSelectMatch={onSelectMatch}
          />
        );
      })}
      {thirdPlace && (
        <Column
          title="Third place"
          matches={[thirdPlace]}
          nameOf={nameOf}
          onSelectMatch={onSelectMatch}
        />
      )}
    </div>
  );
}
