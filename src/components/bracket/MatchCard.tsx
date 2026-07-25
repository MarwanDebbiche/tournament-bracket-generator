import { Check } from 'lucide-react';
import type { ResolvedMatch, ResolvedSide } from '../../engine/resolve';
import { cn } from '../../lib/cn';

function playerIdOf(side: ResolvedSide): string | undefined {
  return side.kind === 'PLAYER' ? side.playerId : undefined;
}

export function MatchCard({
  match,
  nameOf,
  onSelect,
}: {
  match: ResolvedMatch;
  nameOf: (id: string) => string;
  onSelect?: (matchId: string) => void;
}) {
  const { status, winnerId, isWalkover } = match;
  const clickable =
    Boolean(onSelect) &&
    (status === 'READY' || (status === 'DONE' && !isWalkover));
  const isDraw =
    status === 'DONE' &&
    winnerId == null &&
    match.sideA.kind === 'PLAYER' &&
    match.sideB.kind === 'PLAYER';

  const activate = () => {
    if (clickable) onSelect?.(match.id);
  };

  return (
    <div
      onClick={activate}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
              }
            }
          : undefined
      }
      className={cn(
        'overflow-hidden rounded-lg border bg-white shadow-sm transition',
        status === 'PENDING' && 'opacity-60',
        status === 'READY' && 'border-l-2 border-l-indigo-400',
        clickable
          ? 'cursor-pointer border-slate-200 hover:border-indigo-300 hover:shadow'
          : 'border-slate-200',
      )}
    >
      <SideRow
        side={match.sideA}
        score={match.result?.scoreA ?? null}
        isWinner={winnerId != null && playerIdOf(match.sideA) === winnerId}
        nameOf={nameOf}
      />
      <div className="relative border-t border-slate-100">
        {isDraw && (
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-slate-100 px-1 text-[10px] font-medium tracking-wide text-slate-400">
            DRAW
          </span>
        )}
      </div>
      <SideRow
        side={match.sideB}
        score={match.result?.scoreB ?? null}
        isWinner={winnerId != null && playerIdOf(match.sideB) === winnerId}
        nameOf={nameOf}
      />
    </div>
  );
}

function SideRow({
  side,
  score,
  isWinner,
  nameOf,
}: {
  side: ResolvedSide;
  score: number | null;
  isWinner: boolean;
  nameOf: (id: string) => string;
}) {
  const label =
    side.kind === 'PLAYER' ? nameOf(side.playerId) : side.kind === 'BYE' ? 'Bye' : 'TBD';
  const isPlaceholder = side.kind !== 'PLAYER';

  return (
    <div className="flex h-9 items-center justify-between gap-2 px-2.5 text-sm">
      <span
        className={cn(
          'truncate',
          isWinner
            ? 'font-semibold text-slate-900'
            : isPlaceholder
              ? 'italic text-slate-300'
              : 'text-slate-600',
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        {isWinner && <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />}
        {score != null && (
          <span
            className={cn(
              'tabular-nums',
              isWinner ? 'font-semibold text-slate-900' : 'text-slate-400',
            )}
          >
            {score}
          </span>
        )}
      </span>
    </div>
  );
}
