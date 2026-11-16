/**
 * Student UI. RULE: the current level (state.level / log.lv) must never be rendered
 * while a round is in progress — only on the result screen.
 */
import {
  applyAnswer,
  historyFromRound,
  issueQuestion,
  isRoundOver,
  newRound,
  nextQuestion,
  reconcileRound,
  recordFirstWrong,
  roundLength,
  summarize,
} from '../engine/engine';
import type { History, Question, Round, Summary } from '../engine/types';
import { LEVEL_NAME, TAGS, UNIT, submissionText } from '../content';
import { FONT_SIZES, storage, type FontSize } from '../storage';
import { copyText, h, type Child } from './dom';

interface DoneInfo {
  ok: boolean;
  hinted: boolean;
  /** original option index of the final pick */
  pick: number;
}

const FONT_LABELS: Record<FontSize, string> = { '16px': '작게', '19px': '보통', '22px': '크게' };
const MARK = ['①', '②', '③', '④'];

export class App {
  private hist: History;
  private state: Round = newRound();
  /** selected display position (not original index) */
  private sel: number | null = null;
  private done: DoneInfo | null = null;
  private rand = Math.random;

  constructor(
    private root: HTMLElement,
    private bank: Question[],
  ) {
    this.hist = storage.getHistory();
  }

  start() {
    this.renderStart();
  }

  // ---------- flow ----------

  private get total() {
    return roundLength(this.bank);
  }

  private save() {
    storage.setProgress(this.state);
  }

  private beginNew() {
    this.state = newRound();
    this.done = null;
    storage.clearProgress();
    this.advance();
  }

  private resume(saved: Round) {
    this.state = saved;
    this.done = null;
    this.sel = null;
    if (saved.current && this.bank.some((q) => q.id === saved.current!.id)) this.renderQuestion(true);
    else this.advance();
  }

  private advance() {
    this.done = null;
    this.sel = null;
    if (isRoundOver(this.bank, this.state)) return this.finish();
    const q = nextQuestion(this.bank, this.state, this.hist, this.rand);
    if (!q) return this.finish();
    this.state = issueQuestion(this.state, q, this.rand);
    this.save();
    this.renderQuestion(true);
  }

  private confirm() {
    const cur = this.state.current;
    const q = this.currentQuestion();
    if (!cur || !q || this.sel == null) return;
    const pick = cur.order[this.sel];
    const correct = pick === q.answerIndex;
    const firstTry = cur.wrongPick == null;

    if (!correct && firstTry) {
      this.state = recordFirstWrong(this.state, pick);
      this.save();
      this.sel = null;
      this.renderQuestion(false, true);
      return;
    }
    const hinted = !firstTry;
    this.state = applyAnswer(this.state, q, correct, hinted);
    this.save();
    this.done = { ok: correct, hinted, pick };
    this.renderQuestion(false, true, q, cur.order, cur.wrongPick);
  }

  private finish() {
    const summary = summarize(this.state);
    if (this.state.log.length > 0) {
      this.hist = historyFromRound(this.state);
      storage.setHistory(this.hist);
    }
    storage.clearProgress();
    this.renderResult(summary);
  }

  private currentQuestion(): Question | undefined {
    const id = this.state.current?.id;
    return this.bank.find((q) => q.id === id);
  }

  // ---------- layout ----------

  private mount(content: Child[], dock: Child[], focusEl?: HTMLElement) {
    const scroller = h('section', { class: 'content' }, ...content);
    this.root.replaceChildren(this.topbar(), scroller, h('footer', { class: 'dock' }, ...dock));
    scroller.scrollTop = 0;
    focusEl?.focus({ preventScroll: true });
  }

  private topbar(): HTMLElement {
    const current = storage.getFontSize();
    const group = h('div', { class: 'fontsize', role: 'group', 'aria-label': '글자 크기' });
    FONT_SIZES.forEach((fs, i) => {
      group.append(
        h(
          'button',
          {
            type: 'button',
            class: `fs fs-${i}`,
            'aria-pressed': String(fs === current),
            'aria-label': `글자 ${FONT_LABELS[fs]}`,
            onClick: () => {
              storage.setFontSize(fs);
              document.documentElement.style.fontSize = fs;
              group.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
            },
          },
          '가',
        ),
      );
    });
    return h('header', { class: 'topbar' }, h('span', { class: 'unit' }, UNIT.title), group);
  }

  // ---------- screens ----------

  private renderStart() {
    const saved = reconcileRound(storage.getProgress(), this.bank);
    const canResume = !!saved && (saved.n > 0 || !!saved.current) && !isRoundOver(this.bank, saved);
    const title = h('h1', { tabindex: -1 }, UNIT.title);

    const content = [
      h('p', { class: 'eyebrow' }, `${UNIT.subject} · 단원 정리 퀴즈`),
      title,
      h('p', { class: 'lead' }, `한 번에 ${this.total}문항`),
      h(
        'ul',
        { class: 'guide' },
        h('li', {}, '풀이에 따라 다음 문항이 달라져요.'),
        h('li', {}, '시간 제한이 없어요. 천천히 생각해 보세요.'),
        h('li', {}, '틀리면 힌트를 보고 한 번 더 고를 수 있어요.'),
      ),
      h('p', { class: 'note' }, '기록은 이 기기에만 저장돼요. 다른 기기를 쓰거나 브라우저 기록을 지우면 사라져요.'),
    ];

    const dock = canResume
      ? [
          h(
            'button',
            { type: 'button', class: 'btn primary', onClick: () => this.resume(saved!) },
            `이어서 하기 (${saved!.n} / ${this.total})`,
          ),
          h('button', { type: 'button', class: 'btn ghost', onClick: () => this.beginNew() }, '처음부터 다시'),
        ]
      : [h('button', { type: 'button', class: 'btn primary', onClick: () => this.beginNew() }, '시작하기')];

    this.mount(content, dock, title);
  }

  private renderQuestion(
    isNew: boolean,
    focusFeedback = false,
    doneQ?: Question,
    doneOrder?: number[],
    doneWrongPick?: number | null,
  ) {
    // After applyAnswer, state.current is cleared; render from the captured values.
    const q = doneQ ?? this.currentQuestion();
    const cur = this.state.current;
    if (!q) return this.advance();
    const order = doneOrder ?? cur!.order;
    const wrongPick = doneWrongPick !== undefined ? doneWrongPick : (cur?.wrongPick ?? null);
    const done = this.done;
    const number = done ? this.state.n : this.state.n + 1;
    const pct = Math.round((this.state.n / this.total) * 100);

    const heading = h('h2', { class: 'question', tabindex: -1 }, q.question);
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite', tabindex: -1 });

    if (done) {
      const answerText = q.options[q.answerIndex];
      feedback.append(
        done.ok
          ? h(
              'p',
              { class: 'verdict ok' },
              h('span', { class: 'icon', 'aria-hidden': 'true' }, '✓'),
              done.hinted ? '정답이에요! 힌트를 보고 잘 찾아냈어요.' : '정답이에요!',
            )
          : h(
              'p',
              { class: 'verdict no' },
              h('span', { class: 'icon', 'aria-hidden': 'true' }, '✕'),
              `아쉬워요. 정답은 '${answerText}'이에요.`,
            ),
        h('p', { class: 'explain' }, h('strong', {}, '해설 '), q.explanation),
      );
    } else if (wrongPick != null) {
      feedback.append(
        h(
          'p',
          { class: 'verdict no' },
          h('span', { class: 'icon', 'aria-hidden': 'true' }, '✕'),
          '아쉬워요. 힌트를 보고 한 번 더 골라 보세요.',
        ),
        h('p', { class: 'hint' }, h('strong', {}, '힌트 '), q.hint),
      );
    }

    const content = [
      h(
        'div',
        { class: 'progress' },
        h('span', { class: 'count' }, `${number} / ${this.total}`),
        h(
          'div',
          {
            class: 'bar',
            role: 'progressbar',
            'aria-label': '진행',
            'aria-valuemin': 0,
            'aria-valuemax': this.total,
            'aria-valuenow': this.state.n,
          },
          h('span', { style: `width:${pct}%` }),
        ),
      ),
      !q.approved && h('p', { class: 'badge' }, '검수 전 문항이에요'),
      heading,
      feedback,
    ];

    const options = h('div', { class: 'options', role: 'group', 'aria-label': '보기' });
    order.forEach((orig, i) => {
      const isWrongFirst = orig === wrongPick;
      const isAnswer = orig === q.answerIndex;
      const classes = ['opt'];
      let status = '';
      let icon = '';
      if (done) {
        if (isAnswer) {
          classes.push('is-answer');
          status = '정답';
          icon = '✓';
        } else if (orig === done.pick || isWrongFirst) {
          classes.push('is-wrong');
          status = '고른 답';
          icon = '✕';
        }
      } else if (isWrongFirst) {
        classes.push('is-wrong');
        status = '틀린 보기';
        icon = '✕';
      } else if (this.sel === i) {
        classes.push('is-selected');
      }
      options.append(
        h(
          'button',
          {
            type: 'button',
            class: classes.join(' '),
            disabled: !!done || isWrongFirst,
            'aria-pressed': done ? null : String(this.sel === i),
            onClick: () => {
              this.sel = i;
              options.querySelectorAll('.opt').forEach((b, j) => {
                if ((b as HTMLButtonElement).disabled) return;
                b.classList.toggle('is-selected', j === i);
                b.setAttribute('aria-pressed', String(j === i));
              });
              action.disabled = false;
            },
          },
          h('span', { class: 'mark', 'aria-hidden': 'true' }, MARK[i]),
          h('span', { class: 'text' }, q.options[orig]),
          status && h('span', { class: 'status' }, h('span', { 'aria-hidden': 'true' }, icon), ` ${status}`),
        ),
      );
    });

    const last = this.state.n >= this.total || isRoundOver(this.bank, this.state);
    const action = done
      ? h('button', { type: 'button', class: 'btn primary', onClick: () => this.advance() }, last ? '결과 보기' : '다음 문제')
      : h(
          'button',
          { type: 'button', class: 'btn primary', disabled: this.sel == null, onClick: () => this.confirm() },
          '이 답으로 확인',
        );

    this.mount(content, [options, action], isNew ? heading : focusFeedback ? feedback : undefined);
    if (focusFeedback) feedback.scrollIntoView({ block: 'nearest' });
  }

  private renderResult(s: Summary) {
    const title = h('h1', { tabindex: -1 }, '수고했어요!');
    const cheer: Record<number, string> = {
      1: '기초를 차근차근 다졌어요. 다음엔 한 단계 더 올라가 봐요.',
      2: '교과서 수준의 개념을 잘 이해하고 있어요.',
      3: '실험 상황까지 해석하는 심화 문제에 도전했어요. 멋져요!',
    };

    const weak =
      s.weakTags.length === 0
        ? h('p', { class: 'praise' }, '모든 개념을 힌트 없이 해결했어요. 정말 잘했어요!')
        : h(
            'ul',
            { class: 'weak' },
            ...s.weakTags.map((w) =>
              h(
                'li',
                {},
                h('p', { class: 'tag' }, TAGS[w.tag].name),
                h('p', { class: 'counts' }, `오답 ${w.wrong} · 힌트 사용 ${w.hinted}`),
                h('p', { class: 'review' }, TAGS[w.tag].review),
              ),
            ),
          );

    // Optional submission — name/number live only in these inputs, never in storage.
    const no = h('input', { id: 'sno', inputmode: 'numeric', autocomplete: 'off', placeholder: '예: 20315' });
    const name = h('input', { id: 'sname', autocomplete: 'off', placeholder: '이름' });
    const preview = h('pre', { class: 'preview' });
    const status = h('p', { class: 'copy-status', 'aria-live': 'polite' });
    const update = () => (preview.textContent = submissionText(no.value, name.value, s.top, s.mode));
    no.addEventListener('input', update);
    name.addEventListener('input', update);
    update();
    const copyBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn ghost',
        onClick: async () => {
          if (!no.value.trim() || !name.value.trim()) {
            status.textContent = '학번과 이름을 먼저 적어 주세요.';
            return;
          }
          status.textContent = (await copyText(preview.textContent ?? ''))
            ? '복사했어요. 선생님이 알려 주신 곳에 붙여 넣어 주세요.'
            : '복사하지 못했어요. 위 글을 길게 눌러 직접 복사해 주세요.';
        },
      },
      '복사하기',
    );

    const content = [
      title,
      h(
        'div',
        { class: 'card' },
        h('p', { class: 'label' }, '도달한 가장 높은 수준'),
        h('p', { class: 'level' }, LEVEL_NAME[s.top]),
        h('p', {}, cheer[s.top]),
      ),
      h('h2', { class: 'section' }, '다시 살펴볼 개념'),
      weak,
      h(
        'details',
        { class: 'submit' },
        h('summary', {}, '선생님께 결과 보내기 (선택)'),
        h(
          'div',
          { class: 'fields' },
          h('label', { for: 'sno' }, '학번'),
          no,
          h('label', { for: 'sname' }, '이름'),
          name,
        ),
        preview,
        copyBtn,
        status,
        h('p', { class: 'note' }, '학번과 이름은 어디에도 저장되지 않아요.'),
      ),
    ];

    this.mount(content, [h('button', { type: 'button', class: 'btn primary', onClick: () => this.beginNew() }, '다시 풀기')], title);
  }
}
