import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ListTree } from 'lucide-react';
import { useTournamentStore } from '../store/tournamentStore';
import { formatLabel } from '../lib/format';

export default function TournamentPage() {
  const { id } = useParams();
  const tournament = useTournamentStore((s) =>
    s.tournaments.find((t) => t.id === id),
  );

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All tournaments
        </Link>

        {!tournament ? (
          <p className="mt-8 text-slate-600">Tournament not found.</p>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                {tournament.status === 'COMPLETED' ? 'Completed' : 'Running'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {formatLabel(tournament.config)} · {tournament.players.length} players
            </p>

            {tournament.players.length > 0 && (
              <ol className="mt-5 flex flex-wrap gap-1.5">
                {tournament.players.map((player, index) => (
                  <li
                    key={player.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1.5 text-sm text-slate-700"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-500">
                      {index + 1}
                    </span>
                    {player.name || <span className="text-slate-400">Unnamed</span>}
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-6">
              <ListTree className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-800">Tournament launched</p>
                <p className="mt-1">
                  Bracket rendering, group standings, and score entry arrive next
                  (milestones M2–M4).
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
