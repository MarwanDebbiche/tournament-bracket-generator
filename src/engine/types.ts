// Core domain types for the tournament engine.
//
// The engine is pure and framework-free: it never imports React or touches
// localStorage. After a tournament is launched, its `matches` array (the
// structure) is frozen and `results` is the only mutable part; everything else
// is derived by `resolve()` (added in a later milestone).

export type TournamentStatus = 'DRAFT' | 'RUNNING' | 'COMPLETED';

export interface Player {
  id: string;
  name: string;
  /** Strength ranking; 1 = strongest. Drives bracket placement and byes. */
  seed?: number;
}

export type TiebreakerRule =
  | 'HEAD_TO_HEAD'
  | 'GOAL_DIFFERENCE'
  | 'GOALS_FOR'
  | 'WINS'
  | 'MANUAL';

export interface GroupStageConfig {
  numGroups: number;
  /** Qualifiers per group that advance into the knockout stage. */
  advancePerGroup: number;
  points: { win: number; draw: number; loss: number };
  /** Applied in order when two players are level on points. */
  tiebreakers: TiebreakerRule[];
}

export interface KnockoutConfig {
  type: 'SINGLE_ELIM' | 'DOUBLE_ELIM';
  /** Single elimination: play a match between the two semi-final losers. */
  thirdPlaceMatch?: boolean;
  /** Double elimination: replay the grand final if the LB player wins it. */
  grandFinalReset?: boolean;
}

export type SeedingMethod = 'RANDOM' | 'MANUAL' | 'GROUP_STANDING';
export type ScoreMode = 'WIN_LOSS' | 'NUMERIC';

export interface Config {
  /** Optional first stage. `null` goes straight to the elimination stage. */
  groupStage: GroupStageConfig | null;
  knockout: KnockoutConfig;
  seeding: SeedingMethod;
  scoreMode: ScoreMode;
}

export type Phase = 'GROUP' | 'WINNERS' | 'LOSERS' | 'GRAND_FINAL' | 'THIRD_PLACE';

export type Side = 'A' | 'B';

/** A static reference to whoever should occupy a match slot, resolved lazily. */
export type Slot =
  | { kind: 'PLAYER'; playerId: string }
  | { kind: 'BYE' }
  | { kind: 'WINNER_OF'; matchId: string }
  | { kind: 'LOSER_OF'; matchId: string }
  | { kind: 'GROUP_RANK'; groupId: string; rank: number };

export interface Match {
  id: string;
  phase: Phase;
  /** 0-based round index within the phase. */
  round: number;
  /** Position within the round, used for layout. */
  order: number;
  slotA: Slot;
  slotB: Slot;
  /** Where the winner of this match feeds (elimination wiring). */
  winnerTo?: { matchId: string; side: Side };
  /** Where the loser of this match feeds (double elimination). */
  loserTo?: { matchId: string; side: Side };
  groupId?: string;
}

export type Outcome = 'A' | 'B' | 'DRAW';

export interface MatchResult {
  /** null in WIN_LOSS score mode. */
  scoreA: number | null;
  scoreB: number | null;
  outcome: Outcome;
  /** Level scoreline in a knockout match, but a winner was chosen. */
  settledByTiebreak?: boolean;
}

export interface Group {
  id: string;
  name: string;
  playerIds: string[];
}

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  config: Config;
  players: Player[];
  groups: Group[];
  /** Structure — frozen once the tournament is launched. */
  matches: Match[];
  results: Record<string, MatchResult>;
  createdAt: string;
  updatedAt: string;
}
