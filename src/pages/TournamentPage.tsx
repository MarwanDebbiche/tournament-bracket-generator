import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ListTree, RotateCcw } from 'lucide-react';
import { useTournamentStore } from '../store/tournamentStore';
import { resolve } from '../engine/resolve';
import { formatLabel } from '../lib/format';
import { cn } from '../lib/cn';
import { BracketView } from '../components/bracket/BracketView';
import { ChampionBanner } from '../components/bracket/ChampionBanner';
import ScoreEntryDialog from '../components/ScoreEntryDialog';

export default function TournamentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tournament = useTournamentStore((s) =>
    s.tournaments.find((t) => t.id === id),
  );
  const resetTournament = useTournamentStore((s) => s.resetTournament);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const derived = useMemo(
    () => (tournament ? resolve(tournament) : null),
    [tournament],
  );
  const nameOf = useMemo(() => {
    const map = new Map((tournament?.players ?? []).map((p) => [p.id, p.name]));
    return (playerId: string) => map.get(playerId) || 'Unknown';
  }, [tournament?.players]);

  if (!tournament || !derived) {
    return (
      <Shell>
        <p className="mt-8 text-slate-600">Tournament not found.</p>
      </Shell>
    );
  }

  const hasBracket = tournament.matches.length > 0;
  const doneCount = derived.matches.filter((m) => m.status === 'DONE').length;
  const editingMatch = editingMatchId ? derived.byId[editingMatchId] : null;

  const handleReset = () => {
    if (
      window.confirm(
        'Reset this tournament? All recorded results will be cleared and it returns to setup.',
      )
    ) {
      resetTournament(tournament.id);
      navigate(`/setup/${tournament.id}`);
    }
  };

  return (
    <Shell>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
        <StatusBadge completed={tournament.status === 'COMPLETED'} />
        <button
          type="button"
          onClick={handleReset}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {formatLabel(tournament.config)} · {tournament.players.length} players ·{' '}
        {doneCount}/{derived.matches.length} matches played
      </p>

      {derived.champion && (
        <div className="mt-6">
          <ChampionBanner
            champion={nameOf(derived.champion)}
            runnerUp={derived.runnerUp ? nameOf(derived.runnerUp) : undefined}
            thirdPlace={derived.thirdPlace ? nameOf(derived.thirdPlace) : undefined}
          />
        </div>
      )}

      {hasBracket ? (
        <div className="mt-8">
          <BracketView
            derived={derived}
            nameOf={nameOf}
            onSelectMatch={setEditingMatchId}
          />
        </div>
      ) : (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-6">
          <ListTree className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-800">Coming soon</p>
            <p className="mt-1">
              Group standings and the double-elimination bracket arrive in the next
              milestones (M3–M4).
            </p>
          </div>
        </div>
      )}

      {editingMatch && (
        <ScoreEntryDialog
          tournamentId={tournament.id}
          scoreMode={tournament.config.scoreMode}
          match={editingMatch}
          nameOf={nameOf}
          allowDraw={editingMatch.match.phase === 'GROUP'}
          onClose={() => setEditingMatchId(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All tournaments
        </Link>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ completed }: { completed: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        completed
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-blue-50 text-blue-700 ring-blue-200',
      )}
    >
      {completed ? 'Completed' : 'Running'}
    </span>
  );
}
