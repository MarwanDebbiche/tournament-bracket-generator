import type { ReactNode } from 'react';
import type { Tournament } from '../../engine/types';
import type { SetupValidation } from '../../engine/validation';
import { formatLabel } from '../../lib/format';
import { SectionCard } from './controls';
import ValidationPanel from './ValidationPanel';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

export default function ReviewStep({
  tournament,
  validation,
}: {
  tournament: Tournament;
  validation: SetupValidation;
}) {
  const { config, players } = tournament;
  const { groupStage, knockout, seeding, scoreMode } = config;

  const seedingLabel: Record<typeof seeding, string> = {
    RANDOM: 'Random',
    MANUAL: 'Manual (player order)',
    GROUP_STANDING: 'From group standings',
  };

  return (
    <div className="space-y-5">
      <SectionCard title="Summary">
        <dl className="divide-y divide-slate-100">
          <Row label="Name">{tournament.name}</Row>
          <Row label="Format">{formatLabel(config)}</Row>
          <Row label="Players">{players.length}</Row>
          {groupStage && (
            <>
              <Row label="Groups">{groupStage.numGroups}</Row>
              <Row label="Advance per group">{groupStage.advancePerGroup}</Row>
              <Row label="Points (W / D / L)">
                {groupStage.points.win} / {groupStage.points.draw} /{' '}
                {groupStage.points.loss}
              </Row>
            </>
          )}
          <Row label="Elimination">
            {knockout.type === 'DOUBLE_ELIM'
              ? 'Double elimination'
              : 'Single elimination'}
          </Row>
          {knockout.type === 'SINGLE_ELIM' && knockout.thirdPlaceMatch && (
            <Row label="Third-place match">Yes</Row>
          )}
          {knockout.type === 'DOUBLE_ELIM' && knockout.grandFinalReset && (
            <Row label="Grand-final reset">Yes</Row>
          )}
          <Row label="Seeding">{seedingLabel[seeding]}</Row>
          <Row label="Score entry">
            {scoreMode === 'NUMERIC' ? 'Numeric score' : 'Win / draw / loss'}
          </Row>
          {validation.knockout.entrants >= 2 && (
            <Row label="Bracket">
              {validation.knockout.bracketSize} slots
              {validation.knockout.byes > 0
                ? ` · ${validation.knockout.byes} bye${validation.knockout.byes === 1 ? '' : 's'}`
                : ''}
            </Row>
          )}
        </dl>
      </SectionCard>

      {players.length > 0 && (
        <SectionCard title="Players">
          <ol className="flex flex-wrap gap-1.5">
            {players.map((player, index) => (
              <li
                key={player.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pr-3 pl-1.5 text-sm text-slate-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-500">
                  {index + 1}
                </span>
                {player.name || <span className="text-slate-400">Unnamed</span>}
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      <ValidationPanel validation={validation} />
    </div>
  );
}
