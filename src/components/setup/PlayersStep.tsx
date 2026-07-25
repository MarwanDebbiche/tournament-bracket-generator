import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Shuffle,
  Trash2,
  Users,
} from 'lucide-react';
import type { Tournament } from '../../engine/types';
import { useTournamentStore } from '../../store/tournamentStore';
import { cn } from '../../lib/cn';
import { inputClass, SectionCard } from './controls';

const moveButtonClass =
  'rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300';

export default function PlayersStep({ tournament }: { tournament: Tournament }) {
  const renameTournament = useTournamentStore((s) => s.renameTournament);
  const addPlayer = useTournamentStore((s) => s.addPlayer);
  const addPlayers = useTournamentStore((s) => s.addPlayers);
  const renamePlayer = useTournamentStore((s) => s.renamePlayer);
  const removePlayer = useTournamentStore((s) => s.removePlayer);
  const movePlayer = useTournamentStore((s) => s.movePlayer);
  const shufflePlayers = useTournamentStore((s) => s.shufflePlayers);

  const [newName, setNewName] = useState('');
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const { id, players } = tournament;

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    addPlayer(id, trimmed);
    setNewName('');
  };

  const handleBulkAdd = () => {
    const names = bulk
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    addPlayers(id, names);
    setBulk('');
    setShowBulk(false);
  };

  return (
    <div className="space-y-5">
      <SectionCard title="Tournament name">
        <input
          type="text"
          value={tournament.name}
          onChange={(e) => renameTournament(id, e.target.value)}
          aria-label="Tournament name"
          className={inputClass}
        />
      </SectionCard>

      <SectionCard
        title="Players"
        description="The order sets the seeding used when seeding is set to Manual (1 = top seed)."
      >
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a player…"
            aria-label="Player name"
            className={inputClass}
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </form>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowBulk((v) => !v)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {showBulk ? 'Hide bulk add' : 'Add several at once'}
          </button>
          {players.length >= 2 && (
            <button
              type="button"
              onClick={() => shufflePlayers(id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Shuffle className="h-3.5 w-3.5" aria-hidden />
              Shuffle order
            </button>
          )}
        </div>

        {showBulk && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={4}
              placeholder={'One name per line, or comma-separated'}
              aria-label="Bulk player names"
              className={cn(inputClass, 'resize-y')}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleBulkAdd}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Add names
              </button>
            </div>
          </div>
        )}

        {players.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-8 text-center dark:border-slate-700">
            <Users className="h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No players yet — add at least 2.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {players.map((player, index) => (
              <li
                key={player.id}
                className="flex items-center gap-2 bg-white px-2.5 py-1.5 dark:bg-slate-900"
              >
                <span className="w-6 shrink-0 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => renamePlayer(id, player.id, e.target.value)}
                  aria-label={`Player ${index + 1} name`}
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:ring-indigo-500/30"
                />
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => movePlayer(id, player.id, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${player.name || 'player'} up`}
                    className={moveButtonClass}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePlayer(id, player.id, 1)}
                    disabled={index === players.length - 1}
                    aria-label={`Move ${player.name || 'player'} down`}
                    className={moveButtonClass}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePlayer(id, player.id)}
                    aria-label={`Remove ${player.name || 'player'}`}
                    className="ml-1 rounded p-1 text-slate-400 transition hover:bg-red-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500">
          {players.length} player{players.length === 1 ? '' : 's'}
        </p>
      </SectionCard>
    </div>
  );
}
