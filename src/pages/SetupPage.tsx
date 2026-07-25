import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useTournamentStore } from '../store/tournamentStore';
import SetupWizard from '../components/setup/SetupWizard';

export default function SetupPage() {
  const { id } = useParams();
  const tournament = useTournamentStore((s) =>
    s.tournaments.find((t) => t.id === id),
  );

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All tournaments
        </Link>

        {!tournament ? (
          <p className="mt-8 text-slate-600">Tournament not found.</p>
        ) : tournament.status !== 'DRAFT' ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">{tournament.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              This tournament has already been launched, so its setup is locked.
            </p>
            <Link
              to={`/tournament/${tournament.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open tournament
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-6 mb-6 text-2xl font-bold tracking-tight">
              Set up tournament
            </h1>
            <SetupWizard tournament={tournament} />
          </>
        )}
      </div>
    </div>
  );
}
