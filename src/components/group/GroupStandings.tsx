import type { StandingRow } from '../../engine/standings';
import type { ScoreMode } from '../../engine/types';
import { cn } from '../../lib/cn';

export function GroupStandings({
  rows,
  scoreMode,
  advancePerGroup,
  nameOf,
}: {
  rows: StandingRow[];
  scoreMode: ScoreMode;
  advancePerGroup: number;
  nameOf: (id: string) => string;
}) {
  const numeric = scoreMode === 'NUMERIC';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="w-6 py-1 text-right font-medium">#</th>
            <th className="py-1 pl-2 text-left font-medium">Player</th>
            <Stat label="P" title="Played" />
            <Stat label="W" title="Won" />
            <Stat label="D" title="Drawn" />
            <Stat label="L" title="Lost" />
            {numeric && <Stat label="GF" title="Goals for" />}
            {numeric && <Stat label="GA" title="Goals against" />}
            {numeric && <Stat label="GD" title="Goal difference" />}
            <th className="px-1.5 py-1 text-right font-semibold text-slate-500">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const qualifies = i < advancePerGroup;
            return (
              <tr
                key={row.playerId}
                className={cn(
                  'border-t border-slate-100',
                  qualifies && 'bg-emerald-50/50',
                )}
              >
                <td
                  className={cn(
                    'py-1.5 text-right tabular-nums',
                    qualifies ? 'font-semibold text-emerald-600' : 'text-slate-400',
                  )}
                >
                  {i + 1}
                </td>
                <td className="max-w-[10rem] truncate py-1.5 pl-2 font-medium text-slate-800">
                  {nameOf(row.playerId)}
                </td>
                <Cell value={row.played} muted />
                <Cell value={row.won} />
                <Cell value={row.drawn} />
                <Cell value={row.lost} />
                {numeric && <Cell value={row.goalsFor} muted />}
                {numeric && <Cell value={row.goalsAgainst} muted />}
                {numeric && <Cell value={row.goalDifference} signed />}
                <td className="px-1.5 py-1.5 text-right font-semibold tabular-nums text-slate-900">
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

function Cell({
  value,
  muted,
  signed,
}: {
  value: number;
  muted?: boolean;
  signed?: boolean;
}) {
  return (
    <td
      className={cn(
        'px-1.5 py-1.5 text-right tabular-nums',
        muted ? 'text-slate-400' : 'text-slate-600',
      )}
    >
      {signed && value > 0 ? `+${value}` : value}
    </td>
  );
}
