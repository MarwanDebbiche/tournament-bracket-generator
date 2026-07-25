import { useState } from 'react';
import type { ScoreMode } from '../engine/types';
import type { ResolvedMatch } from '../engine/resolve';
import { useTournamentStore } from '../store/tournamentStore';
import { cn } from '../lib/cn';
import { Modal } from './ui/Modal';

export default function ScoreEntryDialog({
  tournamentId,
  scoreMode,
  match,
  nameOf,
  allowDraw = false,
  onClose,
}: {
  tournamentId: string;
  scoreMode: ScoreMode;
  match: ResolvedMatch;
  nameOf: (id: string) => string;
  allowDraw?: boolean;
  onClose: () => void;
}) {
  const recordResult = useTournamentStore((s) => s.recordResult);
  const clearResult = useTournamentStore((s) => s.clearResult);

  const existing = match.result;
  const [winLossWinner, setWinLossWinner] = useState<string | null | undefined>(
    existing ? existing.winnerId : undefined,
  );
  const [scoreA, setScoreA] = useState(
    existing?.scoreA != null ? String(existing.scoreA) : '',
  );
  const [scoreB, setScoreB] = useState(
    existing?.scoreB != null ? String(existing.scoreB) : '',
  );
  const [tieWinner, setTieWinner] = useState<string | null | undefined>(
    existing && existing.scoreA === existing.scoreB ? existing.winnerId : undefined,
  );

  // Both entrants are known when this dialog is opened.
  if (match.sideA.kind !== 'PLAYER' || match.sideB.kind !== 'PLAYER') return null;
  const aId = match.sideA.playerId;
  const bId = match.sideB.playerId;

  const a = Number.parseInt(scoreA, 10);
  const b = Number.parseInt(scoreB, 10);
  const validScores =
    !Number.isNaN(a) && !Number.isNaN(b) && a >= 0 && b >= 0;
  const isTie = validScores && a === b;

  let numericWinner: string | null | undefined;
  if (!validScores) numericWinner = undefined;
  else if (a > b) numericWinner = aId;
  else if (b > a) numericWinner = bId;
  else numericWinner = allowDraw && tieWinner === undefined ? null : tieWinner;

  const winnerId = scoreMode === 'NUMERIC' ? numericWinner : winLossWinner;
  const canSave = winnerId !== undefined;

  const save = () => {
    if (winnerId === undefined) return;
    recordResult(tournamentId, match.id, {
      winnerId,
      scoreA: scoreMode === 'NUMERIC' ? a : null,
      scoreB: scoreMode === 'NUMERIC' ? b : null,
    });
    onClose();
  };

  const handleClear = () => {
    clearResult(tournamentId, match.id);
    onClose();
  };

  return (
    <Modal title="Enter result" onClose={onClose}>
      {scoreMode === 'WIN_LOSS' ? (
        <div className="space-y-2">
          <PickButton
            label={nameOf(aId)}
            selected={winLossWinner === aId}
            onClick={() => setWinLossWinner(aId)}
          />
          <PickButton
            label={nameOf(bId)}
            selected={winLossWinner === bId}
            onClick={() => setWinLossWinner(bId)}
          />
          {allowDraw && (
            <PickButton
              label="Draw"
              selected={winLossWinner === null}
              onClick={() => setWinLossWinner(null)}
              muted
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <ScoreRow name={nameOf(aId)} value={scoreA} onChange={setScoreA} />
          <ScoreRow name={nameOf(bId)} value={scoreB} onChange={setScoreB} />

          {isTie && !allowDraw && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">
                Level score — who advances?
              </p>
              <div className="mt-2 space-y-2">
                <PickButton
                  label={nameOf(aId)}
                  selected={tieWinner === aId}
                  onClick={() => setTieWinner(aId)}
                />
                <PickButton
                  label={nameOf(bId)}
                  selected={tieWinner === bId}
                  onClick={() => setTieWinner(bId)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        {existing ? (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Clear result
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PickButton({
  label,
  selected,
  onClick,
  muted,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition',
        selected
          ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200'
          : 'border-slate-200 text-slate-700 hover:border-slate-300',
        muted && !selected && 'text-slate-500',
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <span className="ml-2 text-xs font-semibold text-indigo-600">Winner</span>}
    </button>
  );
}

function ScoreRow({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
        {name}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Score for ${name}`}
        className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
    </label>
  );
}
