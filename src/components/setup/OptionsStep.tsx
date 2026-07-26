import type {
  Config,
  KnockoutConfig,
  ScoreMode,
  SeedingMethod,
  SwissConfig,
} from '../../engine/types';
import type { SetupValidation } from '../../engine/validation';
import type { Tournament } from '../../engine/types';
import {
  defaultGroupStage,
  defaultSwiss,
  useTournamentStore,
} from '../../store/tournamentStore';
import {
  Field,
  IntInput,
  OptionCards,
  SectionCard,
  Toggle,
} from './controls';
import ValidationPanel from './ValidationPanel';

type FirstStage = 'NONE' | 'GROUPS' | 'SWISS';

function PointsFields({
  points,
  onChange,
}: {
  points: { win: number; draw: number; loss: number };
  onChange: (points: { win: number; draw: number; loss: number }) => void;
}) {
  return (
    <Field label="Points" hint="Awarded per match.">
      <div className="grid grid-cols-3 gap-3">
        {(['win', 'draw', 'loss'] as const).map((key) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs capitalize text-slate-500 dark:text-slate-400">
              {key}
            </span>
            <IntInput
              value={points[key]}
              min={0}
              ariaLabel={`Points for a ${key}`}
              onChange={(v) => onChange({ ...points, [key]: v })}
            />
          </label>
        ))}
      </div>
    </Field>
  );
}

export default function OptionsStep({
  tournament,
  validation,
}: {
  tournament: Tournament;
  validation: SetupValidation;
}) {
  const updateConfig = useTournamentStore((s) => s.updateConfig);
  const { id, config } = tournament;
  const { groupStage, swiss, knockout, seeding, scoreMode } = config;

  const patch = (change: Partial<Config>) => updateConfig(id, change);

  const firstStage: FirstStage = groupStage ? 'GROUPS' : swiss ? 'SWISS' : 'NONE';

  const setFirstStage = (stage: FirstStage) => {
    const change: Partial<Config> = {
      groupStage: stage === 'GROUPS' ? (groupStage ?? defaultGroupStage()) : null,
      swiss: stage === 'SWISS' ? (swiss ?? defaultSwiss()) : null,
    };
    // Group-standing seeding only makes sense with a group stage.
    if (stage !== 'GROUPS' && seeding === 'GROUP_STANDING') change.seeding = 'RANDOM';
    // "No knockout" is only valid when a Swiss stage decides the winner.
    if (stage !== 'SWISS' && knockout.type === 'NONE') {
      change.knockout = { ...knockout, type: 'SINGLE_ELIM' };
    }
    patch(change);
  };

  const setSwiss = (change: Partial<SwissConfig>) =>
    swiss && patch({ swiss: { ...swiss, ...change } });
  const setKnockout = (change: Partial<KnockoutConfig>) =>
    patch({ knockout: { ...knockout, ...change } });

  const knockoutOptions = [
    ...(firstStage === 'SWISS'
      ? [
          {
            value: 'NONE' as const,
            label: 'None',
            description: 'The Swiss standings decide the winner.',
          },
        ]
      : []),
    {
      value: 'SINGLE_ELIM' as const,
      label: 'Single elimination',
      description: 'Lose once and you are out.',
    },
    {
      value: 'DOUBLE_ELIM' as const,
      label: 'Double elimination',
      description: 'Winners + losers brackets; out after two losses.',
    },
  ];

  return (
    <div className="space-y-5">
      <SectionCard
        title="Format"
        description="Choose an optional first stage. Its results seed the elimination stage that follows."
      >
        <OptionCards<FirstStage>
          columns={3}
          value={firstStage}
          onChange={setFirstStage}
          options={[
            {
              value: 'NONE',
              label: 'Straight to bracket',
              description: 'No first stage — go right to the knockout.',
            },
            {
              value: 'GROUPS',
              label: 'Group stage',
              description: 'Round-robin groups; top finishers advance.',
            },
            {
              value: 'SWISS',
              label: 'Swiss system',
              description: 'Fixed rounds pairing similar records.',
            },
          ]}
        />

        {groupStage && (
          <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
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

            <PointsFields
              points={groupStage.points}
              onChange={(points) => patch({ groupStage: { ...groupStage, points } })}
            />

            <p className="text-xs text-slate-400 dark:text-slate-500">
              Ties are broken by head-to-head, then goal difference, goals for, and
              wins.
            </p>
          </div>
        )}

        {swiss && (
          <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Field
              label="Rounds"
              hint="Each round pairs players on similar scores; no one plays the same opponent twice."
            >
              <IntInput
                value={swiss.rounds}
                min={1}
                ariaLabel="Number of Swiss rounds"
                onChange={(rounds) => setSwiss({ rounds })}
              />
            </Field>

            <PointsFields
              points={swiss.points}
              onChange={(points) => setSwiss({ points })}
            />

            <p className="text-xs text-slate-400 dark:text-slate-500">
              Ties are broken by Buchholz (the combined score of a player's
              opponents). A bye counts as a win.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Elimination stage"
        description={
          firstStage === 'SWISS'
            ? 'Optionally send the top finishers into a knockout bracket.'
            : 'Decides the winner.'
        }
      >
        <OptionCards<KnockoutConfig['type']>
          columns={firstStage === 'SWISS' ? 3 : 2}
          value={knockout.type}
          onChange={(type) => setKnockout({ type })}
          options={knockoutOptions}
        />

        {swiss && knockout.type !== 'NONE' && (
          <Field
            label="Players advancing"
            hint="How many of the Swiss standings enter the bracket."
          >
            <IntInput
              value={swiss.advance}
              min={2}
              ariaLabel="Players advancing to the knockout"
              onChange={(advance) => setSwiss({ advance })}
            />
          </Field>
        )}

        {knockout.type === 'SINGLE_ELIM' && (
          <Toggle
            checked={knockout.thirdPlaceMatch ?? false}
            onChange={(thirdPlaceMatch) => setKnockout({ thirdPlaceMatch })}
            label="Third-place match"
            description="The two semi-final losers play for third place."
          />
        )}
        {knockout.type === 'DOUBLE_ELIM' && (
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
