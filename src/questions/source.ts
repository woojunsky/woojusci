/**
 * Question source abstraction. Phase 1–2: static questions.json.
 * Phase 3: swap in a Firestore/Supabase implementation without touching the UI.
 */
import type { Question } from '../engine/types';
import { validateQuestion } from '../engine/validate';

export interface QuestionSource {
  load(unitId: string): Promise<Question[]>;
}

export class StaticJsonSource implements QuestionSource {
  constructor(private url: string) {}

  async load(unitId: string): Promise<Question[]> {
    const res = await fetch(this.url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`문항을 불러오지 못했어요 (${res.status})`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('문항 파일 형식이 올바르지 않아요');
    // Skip malformed items instead of crashing the student app.
    return data.filter((q) => validateQuestion(q).length === 0 && (q as Question).unitId === unitId) as Question[];
  }
}
