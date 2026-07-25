import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Rocket } from 'lucide-react';
import type { Tournament } from '../../engine/types';
import { validateSetup } from '../../engine/validation';
import { useTournamentStore } from '../../store/tournamentStore';
import { cn } from '../../lib/cn';
import PlayersStep from './PlayersStep';
import OptionsStep from './OptionsStep';
import ReviewStep from './ReviewStep';

const STEPS = ['Players', 'Format', 'Review'] as const;

export default function SetupWizard({ tournament }: { tournament: Tournament }) {
  const navigate = useNavigate();
  const launchTournament = useTournamentStore((s) => s.launchTournament);
  const [step, setStep] = useState(0);

  const validation = useMemo(
    () => validateSetup(tournament.players, tournament.config),
    [tournament.players, tournament.config],
  );

  const isLast = step === STEPS.length - 1;

  const handleLaunch = () => {
    const result = launchTournament(tournament.id);
    if (result.ok) navigate(`/tournament/${tournament.id}`);
  };

  return (
    <div>
      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(index)}
                className="group flex items-center gap-2"
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition',
                    current && 'bg-indigo-600 text-white',
                    done && 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
                    !current &&
                      !done &&
                      'bg-slate-100 text-slate-400 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:group-hover:bg-slate-700',
                  )}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium transition',
                    current
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
                  )}
                >
                  {label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step content */}
      <div className="mt-6">
        {step === 0 && <PlayersStep tournament={tournament} />}
        {step === 1 && <OptionsStep tournament={tournament} validation={validation} />}
        {step === 2 && <ReviewStep tournament={tournament} validation={validation} />}
      </div>

      {/* Footer navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:invisible dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={!validation.ok}
            title={validation.ok ? undefined : 'Resolve the issues above to launch'}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
          >
            <Rocket className="h-4 w-4" aria-hidden />
            Launch tournament
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
