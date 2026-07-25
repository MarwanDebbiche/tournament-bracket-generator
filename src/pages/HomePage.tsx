import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Plus, Trash2, Trophy } from 'lucide-react';
import { useTournamentStore } from '../store/tournamentStore';
import type { Tournament, TournamentStatus } from '../engine/types';
import { formatDate, formatLabel } from '../lib/format';

const STATUS_STYLES: Record<TournamentStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
  RUNNING: 'bg-blue-50 text-blue-700 ring-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const STATUS_LABELS: Record<TournamentStatus, string> = {
  DRAFT: 'Draft',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
};

export default function HomePage() {
  const navigate = useNavigate();
  const tournaments = useTournamentStore((s) => s.tournaments);
  const createTournament = useTournamentStore((s) => s.createTournament);
  const [name, setName] = useState('');

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const id = createTournament(name);
    setName('');
    navigate(`/setup/${id}`);
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Trophy className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Tournament Bracket Generator
            </h1>
            <p className="text-sm text-slate-500">
              Create, configure, and run tournaments — saved in your browser.
            </p>
          </div>
        </header>

        <form onSubmit={handleCreate} className="mt-8 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New tournament name…"
            aria-label="New tournament name"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create
          </button>
        </form>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your tournaments
          </h2>

          {tournaments.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="mt-3 space-y-3">
              {tournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const navigate = useNavigate();
  const deleteTournament = useTournamentStore((s) => s.deleteTournament);
  const duplicateTournament = useTournamentStore((s) => s.duplicateTournament);

  const open = () => {
    const path =
      tournament.status === 'DRAFT'
        ? `/setup/${tournament.id}`
        : `/tournament/${tournament.id}`;
    navigate(path);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete “${tournament.name}”? This cannot be undone.`)) {
      deleteTournament(tournament.id);
    }
  };

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow">
      <button
        type="button"
        onClick={open}
        className="block w-full px-4 pt-4 pb-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300"
      >
        <span className="block truncate text-base font-semibold text-slate-900">
          {tournament.name}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">
          {formatLabel(tournament.config)} · Created {formatDate(tournament.createdAt)}
        </span>
      </button>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[tournament.status]}`}
        >
          {STATUS_LABELS[tournament.status]}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => duplicateTournament(tournament.id)}
            aria-label={`Duplicate ${tournament.name}`}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600"
          >
            <Copy className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${tournament.name}`}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-100 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-12 text-center">
      <Trophy className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
      <p className="mt-3 text-sm font-medium text-slate-600">No tournaments yet</p>
      <p className="mt-1 text-sm text-slate-400">
        Name one above and hit Create to get started.
      </p>
    </div>
  );
}
