export type Level = 1 | 2 | 3;
export type Tag = 0 | 1 | 2 | 3;

export interface Question {
  id: number;
  unitId: string;
  level: Level;
  tag: Tag;
  question: string;
  options: [string, string, string, string];
  answerIndex: number; // index into options (0..3)
  hint: string;
  explanation: string;
  approved: boolean;
}

export interface LogEntry {
  id: number;
  tag: Tag;
  /** state.level at the moment the question was issued (NOT the question's own level). */
  lv: Level;
  ok: boolean;
  /** true when the hint was shown for this question (i.e. the first attempt was wrong). */
  hinted: boolean;
}

/** The question currently on screen — persisted so resume can't be used to skip a question. */
export interface CurrentQuestion {
  id: number;
  /** order[i] = original option index shown at display position i. */
  order: number[];
  /** original option index the student picked wrong on the first try, or null. */
  wrongPick: number | null;
}

export interface Round {
  n: number;
  level: Level;
  cs: number;
  ws: number;
  used: number[];
  log: LogEntry[];
  current: CurrentQuestion | null;
}

export interface History {
  /** question ids issued in the previous round */
  seen: number[];
  /** tags that were weak in the previous round (kept for the optional weak-tag bonus) */
  weak: number[];
}

export interface WeakTag {
  tag: Tag;
  wrong: number;
  hinted: number;
}

export interface Summary {
  top: Level;
  mode: Level;
  weakTags: WeakTag[];
}
