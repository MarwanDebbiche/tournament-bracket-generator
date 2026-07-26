import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ListTree, RotateCcw } from 'lucide-react';
import { useTournamentStore } from '../store/tournamentStore';
import { resolve } from '../engine/resolve';
import { formatLabel } from '../lib/format';
import { cn } from '../lib/cn';
import { BracketView } from '../components/bracket/BracketView';
import { DoubleElimBracket } from '../components/bracket/DoubleElimBracket';
import { ChampionBanner } from '../components/bracket/ChampionBanner';
import { GroupStageView } from '../components/group/GroupStageView';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { confirm } from '../components/ui/confirm';
import ScoreEntryDialog from '../components/ScoreEntryDialog';

const SECTION_HEADING =
  'mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

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
        <p className="mt-8 text-slate-600 dark:text-slate-300">Tournament not found.</p>
      </Shell>
    );
  }

  const hasGroupStage = tournament.groups.length > 0;
  const hasKnockout = tournament.matches.some((m) => m.phase === 'WINNERS');
  const isDoubleElim = tournament.matches.some((m) => m.phase === 'GRAND_FINAL');
  // Only real contests count toward progress — byes/walkovers aren't played.
  const playedMatches = derived.matches.filter((m) => !m.skipped && !m.isWalkover);
  const doneCount = playedMatches.filter((m) => m.status === 'DONE').length;
  const editingMatch = editingMatchId ? derived.byId[editingMatchId] : null;

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset tournament',
      message:
        'All recorded results will be cleared and the tournament returns to setup.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (ok) {
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
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {formatLabel(tournament.config)} · {tournament.players.length} players ·{' '}
        {doneCount}/{playedMatches.length} matches played
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

      {hasGroupStage && (
        <section className="mt-8">
          <h2 className={SECTION_HEADING}>Group stage</h2>
          <GroupStageView
            tournament={tournament}
            derived={derived}
            nameOf={nameOf}
            onSelectMatch={setEditingMatchId}
          />
        </section>
      )}

      {hasKnockout && (
        <section className="mt-8">
          {hasGroupStage && <h2 className={SECTION_HEADING}>Knockout</h2>}
          {isDoubleElim ? (
            <DoubleElimBracket
              derived={derived}
              nameOf={nameOf}
              onSelectMatch={setEditingMatchId}
            />
          ) : (
            <BracketView
              derived={derived}
              nameOf={nameOf}
              onSelectMatch={setEditingMatchId}
            />
          )}
        </section>
      )}

      {!hasGroupStage && !hasKnockout && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-6 dark:border-slate-700 dark:bg-slate-900/40">
          <ListTree className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              Nothing to show
            </p>
            <p className="mt-1">This tournament has no matches yet.</p>
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
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All tournaments
          </Link>
          <ThemeToggle />
        </div>
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
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
          : 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
      )}
    >
      {completed ? 'Completed' : 'Running'}
    </span>
  );
}
