import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ListTree } from 'lucide-react';
import { useTournamentStore } from '../store/tournamentStore';

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
            <h1 className="mt-6 text-2xl font-bold tracking-tight">
              {tournament.name}
            </h1>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-6">
              <ListTree className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-800">Live tournament view coming soon</p>
                <p className="mt-1">
                  Group standings, brackets, and score entry will render here once the
                  engine lands (milestones M2–M4).
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
