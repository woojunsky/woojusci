/** Unit metadata and student-facing copy (해요체). */
import type { Level, Tag } from './engine/types';

export const UNIT = {
  id: 'em-current-magnetic',
  title: '전류의 자기 작용',
  subject: '중2 과학',
};

export const LEVEL_NAME: Record<Level, string> = { 1: '기초', 2: '기본', 3: '심화' };

export const TAGS: Record<Tag, { name: string; review: string }> = {
  0: {
    name: '자기장',
    review: '자기장의 방향과 자기력선을 다시 떠올려 보세요. 자기력선은 N극에서 나와 S극으로 들어가요.',
  },
  1: {
    name: '전류가 만드는 자기장',
    review: '전류가 흐르면 도선 둘레에 자기장이 생겨요. 전류의 방향과 세기가 자기장에 주는 영향을 확인해 보세요.',
  },
  2: {
    name: '전자기 유도',
    review: '자기장이 변할 때만 유도 전류가 생겨요. 자석의 움직임, 속도, 코일 감은 수를 비교해 보세요.',
  },
  3: {
    name: '모터',
    review: '자기장 속에서 전류가 흐르는 도선은 힘을 받아요. 전류나 자기장의 방향을 바꾸면 힘의 방향이 바뀌어요.',
  },
};

/** Text the student may copy and send to the teacher. Name/number are never stored. */
export function submissionText(studentNo: string, name: string, top: Level, mode: Level): string {
  return [
    `${studentNo.trim()} ${name.trim()}`.trim(),
    `${UNIT.title}(${UNIT.subject})`,
    `도달한 가장 높은 수준: ${LEVEL_NAME[top]}`,
    `가장 많이 머문 수준: ${LEVEL_NAME[mode]}`,
  ].join('\n');
}
