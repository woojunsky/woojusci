/**
 * localStorage wrapper. Every access is guarded — the app must work when storage is
 * unavailable (private mode, blocked site data). Never store student name / number here.
 */
import type { History, Round } from './engine/types';

export const KEYS = { fontSize: 'mq_fs', progress: 'mq_prog', history: 'mq_hist' } as const;

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : (JSON.parse(v) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep going in memory */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export type FontSize = '16px' | '19px' | '22px';
export const FONT_SIZES: FontSize[] = ['16px', '19px', '22px'];

export const storage = {
  getFontSize(): FontSize {
    const v = read<string>(KEYS.fontSize);
    return FONT_SIZES.includes(v as FontSize) ? (v as FontSize) : '19px';
  },
  setFontSize(v: FontSize) {
    write(KEYS.fontSize, v);
  },
  /** raw value; validate with reconcileRound() against the bank */
  getProgress(): unknown {
    return read<unknown>(KEYS.progress);
  },
  setProgress(r: Round) {
    write(KEYS.progress, r);
  },
  clearProgress() {
    remove(KEYS.progress);
  },
  getHistory(): History {
    const h = read<History>(KEYS.history);
    return {
      seen: Array.isArray(h?.seen) ? h!.seen.filter((x) => typeof x === 'number') : [],
      weak: Array.isArray(h?.weak) ? h!.weak.filter((x) => typeof x === 'number') : [],
    };
  },
  setHistory(h: History) {
    write(KEYS.history, h);
  },
};
