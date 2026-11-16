/**
 * Adaptive engine — pure functions only. No DOM, no storage, no Math.random by default
 * (randomness is injected so tests are deterministic).
 */
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import type { History, Level, LogEntry, Question, Round, Summary, Tag, WeakTag } from './types';

export type Rand = () => number;

const clampLevel = (n: number): Level => (n < 1 ? 1 : n > 3 ? 3 : n) as Level;

export function roundLength(bank: readonly Question[], cfg: EngineConfig = DEFAULT_CONFIG): number {
  return Math.min(cfg.maxRoundLength, bank.length);
}

export function newRound(cfg: EngineConfig = DEFAULT_CONFIG): Round {
  return { n: 0, level: cfg.startLevel, cs: 0, ws: 0, used: [], log: [], current: null };
}

export const EMPTY_HISTORY: History = { seen: [], weak: [] };

export function isRoundOver(bank: readonly Question[], state: Round, cfg: EngineConfig = DEFAULT_CONFIG): boolean {
  if (state.n >= roundLength(bank, cfg)) return true;
  const used = new Set(state.used);
  return !bank.some((q) => !used.has(q.id));
}

/** Score a candidate; lower is better. */
export function scoreQuestion(
  q: Question,
  state: Round,
  hist: History,
  rand: Rand,
  cfg: EngineConfig = DEFAULT_CONFIG,
): number {
  return (
    Math.abs(q.level - state.level) * cfg.levelDistanceWeight +
    (hist.seen.includes(q.id) ? cfg.seenPenalty : 0) +
    (q.approved ? 0 : cfg.unapprovedPenalty) -
    (cfg.weakTagBonus && hist.weak.includes(q.tag) ? cfg.weakTagBonus : 0) +
    rand() * cfg.jitter
  );
}

/** Pick the next question, or null if the round is over / bank exhausted. */
export function nextQuestion(
  bank: readonly Question[],
  state: Round,
  hist: History = EMPTY_HISTORY,
  rand: Rand = Math.random,
  cfg: EngineConfig = DEFAULT_CONFIG,
): Question | null {
  if (state.n >= roundLength(bank, cfg)) return null;
  const used = new Set(state.used);
  let best: Question | null = null;
  let bestScore = Infinity;
  for (const q of bank) {
    if (used.has(q.id)) continue;
    const s = scoreQuestion(q, state, hist, rand, cfg);
    if (s < bestScore) {
      bestScore = s;
      best = q;
    }
  }
  return best;
}

/** Fisher–Yates permutation of option indices. */
export function shuffleOrder(count: number, rand: Rand = Math.random): number[] {
  const a = Array.from({ length: count }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mark a question as issued: records it in `used` and as `current` (for resume). */
export function issueQuestion(state: Round, q: Question, rand: Rand = Math.random): Round {
  return {
    ...state,
    used: state.used.includes(q.id) ? state.used : [...state.used, q.id],
    current: { id: q.id, order: shuffleOrder(q.options.length, rand), wrongPick: null },
  };
}

/** Record a wrong first attempt (hint is now shown). */
export function recordFirstWrong(state: Round, pick: number): Round {
  if (!state.current) return state;
  return { ...state, current: { ...state.current, wrongPick: pick } };
}

/**
 * Apply the final result of a question. Handles promotion/demotion.
 * `ok` = final correctness (a correct answer after the hint counts as correct).
 */
export function applyAnswer(
  state: Round,
  q: Question,
  ok: boolean,
  hinted: boolean,
  cfg: EngineConfig = DEFAULT_CONFIG,
): Round {
  const entry: LogEntry = { id: q.id, tag: q.tag, lv: state.level, ok, hinted };
  let { level, cs, ws } = state;
  if (ok) {
    cs += 1;
    ws = 0;
    if (cs >= cfg.streakToMove) {
      level = clampLevel(level + 1);
      cs = 0;
    }
  } else {
    ws += 1;
    cs = 0;
    if (ws >= cfg.streakToMove) {
      level = clampLevel(level - 1);
      ws = 0;
    }
  }
  return {
    n: state.n + 1,
    level,
    cs,
    ws,
    used: state.used.includes(q.id) ? state.used : [...state.used, q.id],
    log: [...state.log, entry],
    current: null,
  };
}

/**
 * Summarise a finished round.
 * - top: highest state.level at which a question was actually issued.
 * - mode: most frequent issued level; ties go to the lower level.
 * - weakTags: per tag, `wrong` = final wrong answers, `hinted` = correct only after the hint.
 */
export function summarize(state: Round): Summary {
  const log = state.log;
  if (log.length === 0) return { top: state.level, mode: state.level, weakTags: [] };

  let top: Level = 1;
  const counts: Record<Level, number> = { 1: 0, 2: 0, 3: 0 };
  for (const e of log) {
    if (e.lv > top) top = e.lv;
    counts[e.lv] += 1;
  }
  let mode: Level = 1;
  for (const lv of [2, 3] as Level[]) if (counts[lv] > counts[mode]) mode = lv;

  const weakTags: WeakTag[] = [];
  for (const tag of [0, 1, 2, 3] as Tag[]) {
    const entries = log.filter((e) => e.tag === tag);
    const wrong = entries.filter((e) => !e.ok).length;
    const hinted = entries.filter((e) => e.ok && e.hinted).length;
    if (wrong > 0 || hinted > 0) weakTags.push({ tag, wrong, hinted });
  }
  return { top, mode, weakTags };
}

/** History to store after a round, used to avoid repeats on the next attempt. */
export function historyFromRound(state: Round): History {
  return { seen: [...state.used], weak: summarize(state).weakTags.map((w) => w.tag) };
}

/**
 * Sanitise a restored round against the current bank (questions may have been deleted
 * since it was saved). Returns null if the saved state is unusable.
 */
export function reconcileRound(raw: unknown, bank: readonly Question[]): Round | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Round>;
  if (typeof r.n !== 'number' || ![1, 2, 3].includes(r.level as number)) return null;
  if (!Array.isArray(r.used) || !Array.isArray(r.log)) return null;
  const ids = new Set(bank.map((q) => q.id));
  let current = r.current ?? null;
  if (current) {
    const q = bank.find((x) => x.id === current!.id);
    const okOrder =
      q &&
      Array.isArray(current.order) &&
      current.order.length === q.options.length &&
      [...current.order].sort().every((v, i) => v === i);
    if (!okOrder) current = null;
  }
  return {
    n: r.n,
    level: r.level as Level,
    cs: Number(r.cs) || 0,
    ws: Number(r.ws) || 0,
    used: r.used.filter((id): id is number => typeof id === 'number' && ids.has(id)),
    log: r.log as LogEntry[],
    current,
  };
}
