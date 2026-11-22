import logo from '../../assets/logo.webp';
import { ALL_LEVELS } from '../../levels.ts';
import { iconGear } from '../icons.ts';
import { openDevSheet, openSettingsSheet } from '../sheets.ts';
import type { Deps } from '../types.ts';

/** ホームの絵（ChatGPT 製）。 */
const art = (): string => `<img class="logo" src="${logo}" alt="" draggable="false" />`;

export function renderHome(root: HTMLElement, deps: Deps): () => void {
  const { store } = deps;
  const draw = (): void => {
    const total = store.total();
    root.innerHTML = `
      <div class="app app-home home-screen">
        <div class="home-top">
          <button class="icon-btn settings-btn" type="button" aria-label="設定">${iconGear()}</button>
        </div>
        <div class="home">
          <div class="home-art">${art()}</div>
          <h1 class="home-title">しずくバースト</h1>
          <p class="home-sub">しずくを たして あわを はじけさせよう</p>
          <div class="home-buttons">
            <button class="home-btn primary resume-btn" type="button">${total > 0 ? 'つづきから' : 'はじめる'}</button>
            <button class="home-btn select-btn" type="button">ステージを えらぶ</button>
          </div>
          <p class="home-progress">★ ${total} / ${ALL_LEVELS.length * 3}</p>
        </div>
        <button class="dev-pill" type="button">テスト用</button>
      </div>`;
  };
  draw();
  const onClick = (ev: Event): void => {
    const t = ev.target as HTMLElement;
    if (t.closest('.resume-btn')) deps.go({ screen: 'play', levelId: store.firstUncleared() });
    else if (t.closest('.select-btn')) deps.go({ screen: 'select' });
    else if (t.closest('.settings-btn')) openSettingsSheet();
    else if (t.closest('.dev-pill')) openDevSheet(store, draw);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
