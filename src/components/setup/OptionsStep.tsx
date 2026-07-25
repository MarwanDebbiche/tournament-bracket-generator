import type {
  Config,
  KnockoutConfig,
  ScoreMode,
  SeedingMethod,
} from '../../engine/types';
import type { SetupValidation } from '../../engine/validation';
import type { Tournament } from '../../engine/types';
import { defaultGroupStage, useTournamentStore } from '../../store/tournamentStore';
import {
  Field,
  IntInput,
  OptionCards,
  SectionCard,
  Toggle,
} from './controls';
import ValidationPanel from './ValidationPanel';

export default function OptionsStep({
  tournament,
  validation,
}: {
  tournament: Tournament;
  validation: SetupValidation;
}) {
  const updateConfig = useTournamentStore((s) => s.updateConfig);
  const { id, config } = tournament;
  const { groupStage, knockout, seeding, scoreMode } = config;

  const patch = (change: Partial<Config>) => updateConfig(id, change);

  const toggleGroupStage = (on: boolean) => {
    if (on) {
      patch({ groupStage: defaultGroupStage() });
    } else {
      patch({
        groupStage: null,
        // Group-standing seeding is only valid with a group stage.
        seeding: seeding === 'GROUP_STANDING' ? 'RANDOM' : seeding,
      });
    }
  };

  const setKnockout = (change: Partial<KnockoutConfig>) =>
    patch({ knockout: { ...knockout, ...change } });

  return (
    <div className="space-y-5">
      <SectionCard
        title="Group stage"
        description="Optional first stage. Players play round-robin within their group; the top finishers advance to the bracket."
      >
        <Toggle
          checked={groupStage !== null}
          onChange={toggleGroupStage}
          label="Include a group stage"
        />

        {groupStage && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Number of groups">
                <IntInput
                  value={groupStage.numGroups}
                  min={1}
                  ariaLabel="Number of groups"
                  onChange={(numGroups) =>
                    patch({ groupStage: { ...groupStage, numGroups } })
                  }
                />
              </Field>
              <Field label="Advance per group">
                <IntInput
                  value={groupStage.advancePerGroup}
                  min={1}
                  ariaLabel="Advance per group"
                  onChange={(advancePerGroup) =>
                    patch({ groupStage: { ...groupStage, advancePerGroup } })
                  }
                />
              </Field>
            </div>

            <Field label="Points" hint="Awarded per group match.">
              <div className="grid grid-cols-3 gap-3">
                {(['win', 'draw', 'loss'] as const).map((key) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-xs capitalize text-slate-500">
                      {key}
                    </span>
                    <IntInput
                      value={groupStage.points[key]}
                      min={0}
                      ariaLabel={`Points for a ${key}`}
                      onChange={(v) =>
                        patch({
                          groupStage: {
                            ...groupStage,
                            points: { ...groupStage.points, [key]: v },
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </Field>

            <p className="text-xs text-slate-400">
              Ties are broken by head-to-head, then goal difference, goals for, and
              wins.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Elimination stage" description="Decides the winner.">
        <OptionCards<KnockoutConfig['type']>
          value={knockout.type}
          onChange={(type) => setKnockout({ type })}
          options={[
            {
              value: 'SINGLE_ELIM',
              label: 'Single elimination',
              description: 'Lose once and you are out.',
            },
            {
              value: 'DOUBLE_ELIM',
              label: 'Double elimination',
              description: 'Winners + losers brackets; out after two losses.',
            },
          ]}
        />

        {knockout.type === 'SINGLE_ELIM' ? (
          <Toggle
            checked={knockout.thirdPlaceMatch ?? false}
            onChange={(thirdPlaceMatch) => setKnockout({ thirdPlaceMatch })}
            label="Third-place match"
            description="The two semi-final losers play for third place."
          />
        ) : (
          <Toggle
            checked={knockout.grandFinalReset ?? false}
            onChange={(grandFinalReset) => setKnockout({ grandFinalReset })}
            label="Grand-final reset"
            description="If the losers-bracket player wins the grand final, replay it once."
          />
        )}
      </SectionCard>

      <SectionCard title="Seeding" description="How players are placed into the bracket.">
        <OptionCards<SeedingMethod>
          columns={3}
          value={seeding}
          onChange={(value) => patch({ seeding: value })}
          options={[
            { value: 'RANDOM', label: 'Random', description: 'Shuffle the draw.' },
            {
              value: 'MANUAL',
              label: 'Manual',
              description: 'Use the player order.',
            },
            {
              value: 'GROUP_STANDING',
              label: 'Group standing',
              description: 'From group results.',
              disabled: groupStage === null,
              disabledReason: 'Needs a group stage',
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Score entry"
        description="What you record for each match."
      >
        <OptionCards<ScoreMode>
          value={scoreMode}
          onChange={(value) => patch({ scoreMode: value })}
          options={[
            {
              value: 'WIN_LOSS',
              label: 'Win / draw / loss',
              description: 'Just the outcome.',
            },
            {
              value: 'NUMERIC',
              label: 'Numeric score',
              description: 'Enter goals/points (better tiebreakers).',
            },
          ]}
        />
      </SectionCard>

      <ValidationPanel validation={validation} />
    </div>
  );
}
