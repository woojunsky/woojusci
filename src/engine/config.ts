import type { Level } from './types';

export interface EngineConfig {
  /** maximum questions per round; actual = min(maxRoundLength, bank size) */
  maxRoundLength: number;
  startLevel: Level;
  /** consecutive correct/wrong answers needed to move a level */
  streakToMove: number;
  /** score penalty per level of distance from the current level */
  levelDistanceWeight: number;
  /** penalty for questions seen in the previous round */
  seenPenalty: number;
  /**
   * penalty for unapproved (draft) questions.
   * 15 (decided 2026-11-16, PRD open issue 4): an approved question one level away beats
   * an unapproved question at the current level, but never pulls in a question two levels away.
   */
  unapprovedPenalty: number;
  /** random jitter range added to every score (tie-breaker) */
  jitter: number;
  /**
   * bonus (subtracted) for questions whose tag was weak last round.
   * PRD open issue 3: default 0 (off). The prototype used 3.
   */
  weakTagBonus: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  maxRoundLength: 20,
  startLevel: 2,
  streakToMove: 2,
  levelDistanceWeight: 10,
  seenPenalty: 4,
  unapprovedPenalty: 15,
  jitter: 2,
  weakTagBonus: 0,
};
