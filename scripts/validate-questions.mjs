#!/usr/bin/env node
// Validate questions.json: schema (via the shared validator) + bank balance report.
// Usage: node scripts/validate-questions.mjs public/questions.json [--strict]
//   --strict also fails when the bank is not balanced (Phase 2 target: 15 per level, tags 4·4·4·3).
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const [file = 'public/questions.json', ...flags] = process.argv.slice(2);
const strict = flags.includes('--strict');

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let exitCode = 0;
try {
  const { validateBank } = await server.ssrLoadModule('/src/engine/validate.ts');
  const bank = JSON.parse(readFileSync(file, 'utf8'));
  const errors = validateBank(bank);
  for (const e of errors) console.error(`✕ ${e}`);

  const levels = { 1: 0, 2: 0, 3: 0 };
  const grid = {};
  let approved = 0;
  for (const q of Array.isArray(bank) ? bank : []) {
    levels[q.level] = (levels[q.level] ?? 0) + 1;
    grid[`${q.level}-${q.tag}`] = (grid[`${q.level}-${q.tag}`] ?? 0) + 1;
    if (q.approved) approved++;
  }
  const total = Array.isArray(bank) ? bank.length : 0;
  console.log(`문항 ${total}개 · 승인 ${approved}개 · 검수 전 ${total - approved}개`);
  console.log('수준\\태그   0   1   2   3   합');
  for (const lv of [1, 2, 3]) {
    const row = [0, 1, 2, 3].map((t) => String(grid[`${lv}-${t}`] ?? 0).padStart(3)).join(' ');
    console.log(`  ${lv}       ${row}  ${String(levels[lv]).padStart(3)}`);
  }

  if (strict) {
    for (const lv of [1, 2, 3]) {
      if (levels[lv] !== 15) errors.push(`수준 ${lv}: ${levels[lv]}개 (목표 15)`);
      const counts = [0, 1, 2, 3].map((t) => grid[`${lv}-${t}`] ?? 0).sort((a, b) => b - a);
      if (counts.join() !== '4,4,4,3') errors.push(`수준 ${lv}: 태그 분포 ${counts.join('·')} (목표 4·4·4·3)`);
    }
    for (const e of errors.slice(-6)) if (e.includes('목표')) console.error(`✕ ${e}`);
  }

  if (errors.length) {
    console.error(`\n검증 실패: ${errors.length}건`);
    exitCode = 1;
  } else console.log('\n✓ 검증 통과');
} finally {
  await server.close();
}
process.exit(exitCode);
