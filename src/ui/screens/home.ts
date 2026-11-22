import { ALL_LEVELS } from '../../levels.ts';
import { iconGear } from '../icons.ts';
import { openDevSheet, openSettingsSheet } from '../sheets.ts';
import type { Deps } from '../types.ts';

/** ホームの絵。大中小の泡 3 つ（ゲームの盤と同じ描き方）を SVG で。 */
const art = (): string => `
<svg viewBox="0 0 220 160" aria-hidden="true">
  <defs>
    <radialGradient id="b1" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#d6f1fc"/><stop offset="1" stop-color="#8fd3f4"/></radialGradient>
    <radialGradient id="b2" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#a9dcf8"/><stop offset="1" stop-color="#4aa8e8"/></radialGradient>
    <radialGradient id="b3" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#6aa5ea"/><stop offset="1" stop-color="#2b6fd1"/></radialGradient>
  </defs>
  <circle cx="58" cy="92" r="42" fill="url(#b2)" stroke="#2f86c9" stroke-width="3"/>
  <circle cx="50" cy="84" r="5" fill="#fff"/><circle cx="68" cy="100" r="5" fill="#fff"/>
  <circle cx="148" cy="82" r="52" fill="url(#b3)" stroke="#1f55a8" stroke-width="3"/>
  <circle cx="132" cy="68" r="6" fill="#fff"/><circle cx="164" cy="68" r="6" fill="#fff"/><circle cx="148" cy="98" r="6" fill="#fff"/>
  <circle cx="108" cy="30" r="22" fill="url(#b1)" stroke="#6bb9de" stroke-width="3"/>
  <circle cx="108" cy="30" r="5" fill="#fff"/>
  <ellipse cx="40" cy="74" rx="9" ry="5" fill="#fff" opacity=".6"/><ellipse cx="128" cy="52" rx="11" ry="6" fill="#fff" opacity=".55"/>
  <g fill="#4aa8e8"><circle cx="186" cy="22" r="5"/><circle cx="200" cy="40" r="4"/><circle cx="20" cy="40" r="4"/><circle cx="8" cy="58" r="3"/></g>
</svg>`;

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
