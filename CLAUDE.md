# 적응형 과학 진단 퀴즈

중2 과학 단원 정리용 적응형 4지선다 퀴즈 (시범 단원: 전류의 자기 작용). 학생은 로그인 없이 스마트폰 세로 화면에서 사용하고, 교사는 문항을 검수·승인한다. 전체 요구사항은 [PRD.md](PRD.md)에 있다.

## 명령

- `npm run dev`: 개발 서버 (`--host`라 같은 Wi-Fi의 휴대폰에서 접속 가능)
- `npm test`: 엔진 단위 테스트 (Vitest)
- `npm run validate`: `public/questions.json` 스키마 검증 + 수준·태그 분포 표 (`-- --strict`를 붙이면 45문항 목표 분포까지 검사)
- `npm run check`: 타입 검사 + 테스트 + 문항 검증
- `npm run build`: `dist/` 정적 빌드

## 구조

- `src/engine/`: **순수 함수만** 둔다 (DOM, localStorage, 전역 `Math.random` 직접 사용 금지. 난수는 `rand` 인자로 주입). `engine.ts`, `config.ts`(가중치·상수), `validate.ts`(문항 스키마, 교사 화면에서도 재사용)
- `src/storage.ts`: localStorage 래퍼. 모든 접근을 try/catch로 감싼다. 키는 `mq_fs`, `mq_prog`, `mq_hist`
- `src/questions/source.ts`: `QuestionSource` 인터페이스. Phase 1~2는 정적 `questions.json`, Phase 3에서 Firestore 등으로 교체한다
- `src/ui/`: 바닐라 TS UI (`app.ts`가 시작·문항·결과 화면)
- `public/questions.json`: 문항 은행
- `tests/engine.test.ts`: PRD 5장 필수 케이스 11개 + 추가 케이스

## 반드시 지킬 규칙

- 풀이 중 어떤 화면·속성·aria에도 **현재 수준을 노출하지 않는다**. 결과 화면에서만 공개한다.
- 점수, 정답률, 순위, 타이머, 레벨업 연출, 배지, 효과음을 넣지 않는다.
- 학번·이름은 입력창에만 둔다. 저장소·서버에 남기지 않는다.
- 미승인 문항(`approved=false`)에는 '검수 전' 표시를 붙인다.
- 정답·오답은 색만이 아니라 아이콘(✓/✕)과 글자로도 표시한다.
- 문구는 부드러운 해요체로 쓴다.
- 포인트 색은 분필 노랑(`--accent`) 하나만 쓴다. 색은 `:root` CSS 변수로만 정의한다.

## PRD 대비 확정·보완 사항 (2026-11-16)

- 회차 길이: `min(20, 은행 크기)` (PRD 그대로)
- 점수식의 미승인 가중치는 **100이 아니라 15**다 (`config.unapprovedPenalty`). 인접 수준의 승인 문항이 같은 수준의 미승인 문항보다 우선하지만, 두 수준 떨어진 문항까지 끌어오지는 않는다.
- '도달한 가장 높은 수준' = 출제 시점의 `state.level`(`log.lv`)의 최댓값 (PRD 그대로). 보충 문항도 포함한다.
- 약한 개념 가산점은 기본값 0이다 (`config.weakTagBonus`, PRD 열린 이슈 3).
- `mq_prog`에 `current {id, order, wrongPick}`를 추가로 저장한다. 새로고침으로 힌트 단계를 건너뛰거나 문항을 바꿀 수 없게 하기 위해서다. 복원할 때 `reconcileRound`가 은행에 없는 id를 걸러낸다.
- weakTags 집계: `wrong` = 최종 오답, `hinted` = 힌트를 보고 맞힌 문항. 오답은 항상 힌트를 거치므로 중복 집계하지 않는다.
- 칠판 테마는 라이트/다크 모두 칠판색을 유지하고, 다크에서는 조금 더 어둡게만 한다.
