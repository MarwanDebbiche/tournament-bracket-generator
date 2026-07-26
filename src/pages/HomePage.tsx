import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, Plus, Trash2, Trophy, Upload } from 'lucide-react';
import { useTournamentStore } from '../store/tournamentStore';
import type { Tournament, TournamentStatus } from '../engine/types';
import { formatDate, formatLabel } from '../lib/format';
import { downloadTournamentJson, parseTournamentFile } from '../lib/exportImport';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { confirm } from '../components/ui/confirm';

const STATUS_STYLES: Record<TournamentStatus, string> = {
  DRAFT:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  RUNNING:
    'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  COMPLETED:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
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
  const importTournament = useTournamentStore((s) => s.importTournament);
  const [name, setName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const id = createTournament(name);
    setName('');
    navigate(`/setup/${id}`);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-importing the same file
    if (!file) return;
    const tournament = parseTournamentFile(await file.text());
    if (!tournament) {
      setImportError(`"${file.name}" is not a valid tournament file.`);
      return;
    }
    const id = importTournament(tournament);
    navigate(
      tournament.status === 'DRAFT' ? `/setup/${id}` : `/tournament/${id}`,
    );
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Trophy className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              Tournament Bracket Generator
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create, configure, and run tournaments — saved in your browser.
            </p>
          </div>
          <ThemeToggle className="ml-auto" />
        </header>

        <form onSubmit={handleCreate} className="mt-8 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New tournament name…"
            aria-label="New tournament name"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-500/30"
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
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Your tournaments
            </h2>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
          </div>

          {importError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {importError}
            </p>
          )}

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

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete tournament',
      message: `Delete “${tournament.name}”? This can’t be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteTournament(tournament.id);
  };

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <button
        type="button"
        onClick={open}
        className="block w-full px-4 pt-4 pb-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300"
      >
        <span className="block truncate text-base font-semibold text-slate-900 dark:text-slate-100">
          {tournament.name}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
          {formatLabel(tournament.config)} · Created {formatDate(tournament.createdAt)}
        </span>
      </button>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2 dark:border-slate-800 dark:bg-slate-800/40">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[tournament.status]}`}
        >
          {STATUS_LABELS[tournament.status]}
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            label={`Export ${tournament.name}`}
            onClick={() => downloadTournamentJson(tournament)}
          >
            <Download className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton
            label={`Duplicate ${tournament.name}`}
            onClick={() => duplicateTournament(tournament.id)}
          >
            <Copy className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton
            label={`Delete ${tournament.name}`}
            onClick={handleDelete}
            danger
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        danger
          ? 'rounded-md p-1.5 text-slate-400 transition hover:bg-red-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/20 dark:hover:text-red-400'
          : 'rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
      }
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <Trophy className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden />
      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
        No tournaments yet
      </p>
      <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
        Name one above and hit Create to get started.
      </p>
    </div>
  );
}
