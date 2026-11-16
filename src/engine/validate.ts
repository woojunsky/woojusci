/** Question schema validation — shared by the build-time script and (later) the teacher editor. */
import type { Question } from './types';

export function validateQuestion(q: unknown): string[] {
  const errs: string[] = [];
  if (!q || typeof q !== 'object') return ['문항이 객체가 아니에요'];
  const x = q as Record<string, unknown>;
  if (!Number.isInteger(x.id)) errs.push('id는 정수여야 해요');
  if (typeof x.unitId !== 'string' || !x.unitId) errs.push('unitId가 필요해요');
  if (![1, 2, 3].includes(x.level as number)) errs.push('level은 1~3이어야 해요');
  if (![0, 1, 2, 3].includes(x.tag as number)) errs.push('tag는 0~3이어야 해요');
  for (const k of ['question', 'hint', 'explanation'] as const) {
    if (typeof x[k] !== 'string' || !(x[k] as string).trim()) errs.push(`${k}를 채워야 해요`);
  }
  if (!Array.isArray(x.options) || x.options.length !== 4) {
    errs.push('보기는 정확히 4개여야 해요');
  } else {
    if (x.options.some((o) => typeof o !== 'string' || !o.trim())) errs.push('보기 4개를 모두 채워야 해요');
    if (new Set(x.options.map((o) => String(o).trim())).size !== 4) errs.push('보기가 서로 달라야 해요');
  }
  if (!Number.isInteger(x.answerIndex) || (x.answerIndex as number) < 0 || (x.answerIndex as number) > 3)
    errs.push('정답(answerIndex)을 0~3 중 하나로 지정해야 해요');
  if (typeof x.approved !== 'boolean') errs.push('approved는 true/false여야 해요');
  return errs;
}

export function validateBank(bank: unknown): string[] {
  if (!Array.isArray(bank)) return ['문항 은행이 배열이 아니에요'];
  const errs: string[] = [];
  const seen = new Set<number>();
  bank.forEach((q, i) => {
    const label = `#${i} (id=${(q as Question)?.id})`;
    for (const e of validateQuestion(q)) errs.push(`${label}: ${e}`);
    const id = (q as Question)?.id;
    if (seen.has(id)) errs.push(`${label}: id 중복`);
    seen.add(id);
  });
  return errs;
}
