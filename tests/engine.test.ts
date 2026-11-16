import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  historyFromRound,
  issueQuestion,
  isRoundOver,
  newRound,
  nextQuestion,
  reconcileRound,
  roundLength,
  summarize,
  type Rand,
} from '../src/engine/engine';
import type { Level, Question, Round, Tag } from '../src/engine/types';
import { validateBank } from '../src/engine/validate';

/** Deterministic PRNG (mulberry32). */
function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1;
function q(level: Level, tag: Tag = 0, approved = true): Question {
  const id = nextId++;
  return {
    id,
    unitId: 'test',
    level,
    tag,
    question: `Q${id}`,
    options: ['a', 'b', 'c', 'd'],
    answerIndex: 0,
    hint: 'h',
    explanation: 'e',
    approved,
  };
}

/** 24-question bank: 8 per level, 2 per tag. */
function bank24(): Question[] {
  const b: Question[] = [];
  for (const lv of [1, 2, 3] as Level[]) for (const tag of [0, 1, 2, 3] as Tag[]) b.push(q(lv, tag), q(lv, tag));
  return b;
}

const at = (level: Level, extra: Partial<Round> = {}): Round => ({ ...newRound(), level, ...extra });
const answer = (s: Round, ok: boolean, hinted = false, lv: Level = s.level) => applyAnswer(s, q(lv), ok, hinted);

describe('승급/강등 (PRD 5장)', () => {
  it('#1 기본(2)에서 연속 2정답 → 심화(3), cs=0', () => {
    const s = answer(answer(at(2), true), true);
    expect(s.level).toBe(3);
    expect(s.cs).toBe(0);
  });

  it('#2 기본(2)에서 연속 2오답 → 기초(1), ws=0', () => {
    const s = answer(answer(at(2), false), false);
    expect(s.level).toBe(1);
    expect(s.ws).toBe(0);
  });

  it('#3 정답-오답-정답 교차 → 수준 변화 없음', () => {
    const s = answer(answer(answer(at(2), true), false), true);
    expect(s.level).toBe(2);
    expect(s.cs).toBe(1);
    expect(s.ws).toBe(0);
  });

  it('#4 심화(3)에서 연속 2정답 → 심화 유지', () => {
    expect(answer(answer(at(3), true), true).level).toBe(3);
  });

  it('#5 기초(1)에서 연속 2오답 → 기초 유지', () => {
    expect(answer(answer(at(1), false), false).level).toBe(1);
  });

  it('#6 힌트 후 정답 → 정답, hinted 기록, 승급 카운트 포함', () => {
    let s = answer(at(2), true, true);
    expect(s.log[0]).toMatchObject({ ok: true, hinted: true });
    expect(s.cs).toBe(1);
    s = answer(s, true);
    expect(s.level).toBe(3);
    expect(summarize(s).weakTags).toEqual([{ tag: 0, wrong: 0, hinted: 1 }]);
  });

  it('log.lv는 문항 수준이 아니라 출제 시점 state.level', () => {
    const s = applyAnswer(at(3), q(2), true, false);
    expect(s.log[0].lv).toBe(3);
  });
});

describe('문항 선택 (PRD 2.3)', () => {
  it('#7 현재 수준 문항 소진 → 인접 수준으로 보충', () => {
    const b = bank24();
    const l3 = b.filter((x) => x.level === 3).map((x) => x.id);
    const pick = nextQuestion(b, at(3, { used: l3 }), undefined, seeded(1));
    expect(pick?.level).toBe(2);
  });

  it('현재 수준 문항이 있으면 그것을 우선', () => {
    const b = bank24();
    for (let seed = 0; seed < 50; seed++) expect(nextQuestion(b, at(1), undefined, seeded(seed))?.level).toBe(1);
  });

  it('#8 같은 회차 중복 출제 없음 (회차 전체 시뮬레이션)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rand = seeded(seed);
      const b = bank24();
      let s = newRound();
      while (!isRoundOver(b, s)) {
        const next = nextQuestion(b, s, undefined, rand)!;
        s = issueQuestion(s, next, rand);
        s = applyAnswer(s, next, rand() < 0.6, false);
      }
      expect(s.n).toBe(20);
      expect(new Set(s.used).size).toBe(20);
      expect(new Set(s.log.map((e) => e.id)).size).toBe(20);
    }
  });

  it('#9 지난 회차 seen 문항은 새 문항이 있으면 후순위', () => {
    const b = bank24();
    const l2 = b.filter((x) => x.level === 2);
    const seen = l2.slice(0, 6).map((x) => x.id);
    for (let seed = 0; seed < 50; seed++) {
      const pick = nextQuestion(b, at(2), { seen, weak: [] }, seeded(seed))!;
      expect(seen).not.toContain(pick.id);
      expect(pick.level).toBe(2);
    }
  });

  it('seen 문항이라도 같은 수준이면 인접 수준 새 문항보다 우선 (되도록 피함)', () => {
    const b = bank24();
    const seen = b.filter((x) => x.level === 2).map((x) => x.id);
    expect(nextQuestion(b, at(2), { seen, weak: [] }, seeded(3))?.level).toBe(2);
  });

  it('승인 문항 우선: 인접 수준 승인 > 같은 수준 미승인', () => {
    const b = [q(2, 0, false), q(2, 1, false), q(3, 0, true)];
    for (let seed = 0; seed < 20; seed++) expect(nextQuestion(b, at(2), undefined, seeded(seed))?.approved).toBe(true);
  });

  it('승인 우선이라도 두 수준 떨어진 승인 문항보다 같은 수준 미승인 우선', () => {
    const b = [q(1, 0, false), q(3, 0, true)];
    for (let seed = 0; seed < 20; seed++) expect(nextQuestion(b, at(1), undefined, seeded(seed))?.level).toBe(1);
  });

  it('#11 문항 은행이 20개 미만 → 회차 길이 = 은행 크기', () => {
    const b = bank24().slice(0, 7);
    expect(roundLength(b)).toBe(7);
    const rand = seeded(9);
    let s = newRound();
    while (!isRoundOver(b, s)) {
      const next = nextQuestion(b, s, undefined, rand)!;
      s = applyAnswer(issueQuestion(s, next, rand), next, true, false);
    }
    expect(s.n).toBe(7);
    expect(nextQuestion(b, s, undefined, rand)).toBeNull();
  });
});

describe('결과 요약 (PRD 2.5)', () => {
  it('#10 승급만 하고 해당 수준 문항을 풀지 않음 → top에 반영 안 됨', () => {
    const s = answer(answer(at(2), true), true);
    expect(s.level).toBe(3);
    expect(summarize(s).top).toBe(2);
  });

  it('mode: 최빈 수준, 동률이면 낮은 수준', () => {
    let s = at(2);
    s = answer(s, true); // lv2
    s = answer(s, true); // lv2 → 3
    s = answer(s, false); // lv3
    s = answer(s, false); // lv3 → 2
    expect(summarize(s).mode).toBe(2);
    s = answer(s, true); // lv2
    expect(summarize(s).mode).toBe(2);
  });

  it('weakTags: 오답과 힌트 사용을 태그별로 집계', () => {
    let s = at(2);
    s = applyAnswer(s, q(2, 1), false, true);
    s = applyAnswer(s, q(2, 1), true, true);
    s = applyAnswer(s, q(2, 3), true, false);
    expect(summarize(s).weakTags).toEqual([{ tag: 1, wrong: 1, hinted: 1 }]);
  });

  it('historyFromRound: 이번 회차 문항과 약한 태그 저장', () => {
    let s = at(2);
    const a = q(2, 2);
    s = applyAnswer(issueQuestion(s, a), a, false, true);
    expect(historyFromRound(s)).toEqual({ seen: [a.id], weak: [2] });
  });
});

describe('이어서 하기 복원', () => {
  it('은행에서 사라진 문항 id는 제거, current도 정리', () => {
    const b = bank24();
    const raw = { ...newRound(), n: 1, used: [b[0].id, 9999], current: { id: 9999, order: [0, 1, 2, 3], wrongPick: null } };
    const r = reconcileRound(raw, b)!;
    expect(r.used).toEqual([b[0].id]);
    expect(r.current).toBeNull();
  });

  it('진행 중 문항과 힌트 상태 유지', () => {
    const b = bank24();
    const raw = { ...newRound(), used: [b[0].id], current: { id: b[0].id, order: [2, 0, 3, 1], wrongPick: 2 } };
    expect(reconcileRound(raw, b)?.current).toEqual(raw.current);
  });

  it('깨진 저장값은 null', () => {
    expect(reconcileRound('x', [])).toBeNull();
    expect(reconcileRound({ n: 1, level: 7, used: [], log: [] }, [])).toBeNull();
  });
});

describe('문항 스키마 검증', () => {
  it('정상 문항 통과, 잘못된 문항 검출', () => {
    expect(validateBank(bank24())).toEqual([]);
    const bad = { ...q(2), options: ['a', 'b', '', 'd'], answerIndex: 4, level: 5 };
    expect(validateBank([bad]).length).toBeGreaterThanOrEqual(3);
  });
});
