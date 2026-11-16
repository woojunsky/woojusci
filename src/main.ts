import './style.css';
import { StaticJsonSource } from './questions/source';
import { UNIT } from './content';
import { storage } from './storage';
import { App } from './ui/app';

const root = document.getElementById('app')!;
document.documentElement.style.fontSize = storage.getFontSize();

new StaticJsonSource(`${import.meta.env.BASE_URL}questions.json`)
  .load(UNIT.id)
  .then((bank) => {
    if (bank.length === 0) throw new Error('사용할 수 있는 문항이 없어요.');
    new App(root, bank).start();
  })
  .catch((err: Error) => {
    root.replaceChildren();
    const p = document.createElement('p');
    p.className = 'loading';
    p.textContent = `${err.message} 잠시 뒤 다시 열어 주세요.`;
    root.append(p);
  });
