import { Trophy } from 'lucide-react';

export function ChampionBanner({
  champion,
  runnerUp,
  thirdPlace,
}: {
  champion: string;
  runnerUp?: string;
  thirdPlace?: string;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-md">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
          <Trophy className="h-7 w-7" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-200">
            Champion
          </div>
          <div className="truncate text-2xl font-bold">{champion}</div>
        </div>
      </div>
      {(runnerUp || thirdPlace) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-indigo-100">
          {runnerUp && (
            <span>
              <span className="text-indigo-300">Runner-up:</span> {runnerUp}
            </span>
          )}
          {thirdPlace && (
            <span>
              <span className="text-indigo-300">Third:</span> {thirdPlace}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
