import { type Board, type TapResult, bubblesLeft, isClear, tap } from '../../engine.ts';
import { boardOf, getLevel, nextLevelId, starsFor } from '../../levels.ts';
import { iconBack, iconGear, iconHelp, iconHint, iconReset, iconUndo } from '../icons.ts';
import { openHelpSheet, openSettingsSheet } from '../sheets.ts';
import { sfx } from '../sfx.ts';
import { markSeen, seen } from '../storage.ts';
import type { Deps } from '../types.ts';

// しずくが 1 マス進む時間（ms）。確認用に ?slow=6 でゆっくりにできる。
const TICK = 80 * Math.max(1, Number(new URLSearchParams(location.search).get('slow')) || 1);

const pips = (): string => '<i class="p1"></i><i class="p2"></i><i class="p3"></i>';

export function renderGame(root: HTMLElement, levelId: string, deps: Deps): () => void {
  const def = getLevel(levelId);
  if (!def) {
    deps.go({ screen: 'home' });
    return () => {};
  }
  const level = def;
  const init = boardOf(level);
  const { w, h } = init;
  let board: Board = init;
  let shown: number[] = init.cells.slice();
  const history: Board[] = [];
  let taps = 0;
  let animating = false;
  let finish: (() => void) | null = null;
  let winTimer = 0;
  let toastTimer = 0;
  let disposed = false;

  let cells = '';
  for (let i = 0; i < w * h; i++) cells += `<div class="cell" data-i="${i}"><b class="bubble v0">${pips()}</b></div>`;
  const next = nextLevelId(level.id);

  root.innerHTML = `
    <div class="app app-game game-screen">
      <header class="header">
        <div class="header-row">
          <div class="header-left"><button class="icon-btn back-btn" type="button" aria-label="もどる">${iconBack()}</button></div>
          <h1 class="title">${level.id}</h1>
          <div class="header-actions">
            <button class="icon-btn help-btn" type="button" aria-label="遊びかた">${iconHelp()}</button>
            <button class="icon-btn settings-btn" type="button" aria-label="設定">${iconGear()}</button>
          </div>
        </div>
        <div class="status-bar">
          <span class="stat"><span class="stat-label">タップ</span><span class="stat-num taps">0</span><span class="stat-label">さいたん ${level.par}</span></span>
          <span class="stat"><span class="stat-label">あわ</span><span class="stat-num left">${bubblesLeft(init)}</span></span>
        </div>
      </header>
      <div class="board-wrap">
        <div class="board" style="--cols:${w};--rows:${h}">${cells}<div class="drops"></div><div class="toast" hidden></div></div>
      </div>
      <footer class="footer">
        <button class="tool undo-btn" type="button" aria-label="もどす" disabled>${iconUndo()}</button>
        <button class="tool retry-btn" type="button" aria-label="やりなおし">${iconReset()}</button>
        <button class="tool hint-btn" type="button" aria-label="ヒント">${iconHint()}</button>
      </footer>
      <div class="overlay game-message" hidden>
        <div class="sheet message-card">
          <p class="message-title">クリア!</p>
          <div class="stars"></div>
          <p class="message-moves"></p>
          <div class="message-buttons">
            <button class="sheet-btn next-btn" type="button">つぎへ</button>
            <button class="sheet-btn quiet again-btn" type="button">もういちど</button>
            <button class="sheet-btn quiet select-btn" type="button">ステージせんたく</button>
          </div>
        </div>
      </div>
    </div>`;

  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const boardEl = q('.board');
  const dropsEl = q('.drops');
  const toastEl = q('.toast');
  const tapsEl = q('.taps');
  const leftEl = q('.left');
  const undoBtn = q<HTMLButtonElement>('.undo-btn');
  const msg = q('.game-message');
  const cellEls = Array.from(boardEl.querySelectorAll<HTMLElement>('.cell'));
  const bubbleEls = cellEls.map((c) => c.querySelector<HTMLElement>('.bubble')!);
  if (!next) q('.next-btn').setAttribute('hidden', '');

  const setBubble = (i: number, v: number, bump = false): void => {
    const el = bubbleEls[i]!;
    el.className = v < 0 ? 'bubble vS' : `bubble v${v}`;
    if (bump && v > 0) {
      void el.offsetWidth;
      el.classList.add('bump');
    }
  };
  const renderAll = (cs: number[]): void => {
    shown = cs.slice();
    for (let i = 0; i < cs.length; i++) setBubble(i, cs[i]!);
    leftEl.textContent = String(cs.filter((v) => v > 0).length);
  };
  renderAll(init.cells);

  const toast = (t: string, ms = 1800): void => {
    toastEl.textContent = t;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.hidden = true), ms);
  };

  // 新しい規則（石）は、初めて出る面で 1 行だけ見せる
  if (init.cells.some((v) => v < 0) && !seen('stone')) {
    markSeen('stone');
    toast('石は しずくを とめるよ', 4500);
  }

  const cellSize = (): number => boardEl.getBoundingClientRect().width / w;
  const center = (i: number, cs: number): { x: number; y: number } => ({ x: ((i % w) + 0.5) * cs, y: (Math.floor(i / w) + 0.5) * cs });

  const popFx = (i: number): void => {
    const el = cellEls[i]!;
    el.classList.remove('burst');
    void el.offsetWidth;
    el.classList.add('burst');
    window.setTimeout(() => el.classList.remove('burst'), 260);
  };

  /** 1 回のタップの結果を、しずくの飛ぶ様子つきで見せる。途中で次の操作が来たら finish() で最後まで飛ばす。 */
  function animate(res: TapResult, tapped: number, onDone: () => void): void {
    animating = true;
    const cs = cellSize();
    const timers: number[] = [];
    let ended = false;
    const end = (): void => {
      if (ended) return;
      ended = true;
      timers.forEach((t) => window.clearTimeout(t));
      dropsEl.replaceChildren();
      renderAll(res.board.cells);
      animating = false;
      finish = null;
      onDone();
    };
    finish = end;
    renderAll(res.first);
    if (res.popped) {
      popFx(tapped);
      sfx.pop(0);
    }
    let t = 0;
    res.ticks.forEach((tick, ti) => {
      timers.push(
        window.setTimeout(() => {
          if (ended) return;
          for (const f of tick.flights) {
            const a = center(f.from, cs);
            const to = f.to >= 0 ? center(f.to, cs) : { x: a.x + [0, 0, -1, 1][f.dir]! * cs, y: a.y + [-1, 1, 0, 0][f.dir]! * cs };
            const d = document.createElement('i');
            d.className = 'drop';
            dropsEl.appendChild(d);
            const rot = [0, 180, -90, 90][f.dir]!; // しずくの尖った先を飛ぶ向きへ
            d.animate([{ transform: `translate(${a.x}px, ${a.y}px) rotate(${rot}deg)` }, { transform: `translate(${to.x}px, ${to.y}px) rotate(${rot}deg)` }], { duration: TICK, easing: 'linear', fill: 'forwards' });
          }
        }, t),
      );
      t += TICK;
      timers.push(
        window.setTimeout(() => {
          if (ended) return;
          dropsEl.replaceChildren();
          for (const f of tick.flights) {
            if (f.hit >= 0) sfx.land();
            else if (f.hit === -2) sfx.plink();
          }
          for (let i = 0; i < tick.cells.length; i++) {
            const v = tick.cells[i]!;
            if (tick.pops.includes(i)) {
              popFx(i);
              setBubble(i, 0);
              sfx.pop(ti + 1);
            } else if (v !== shown[i]) {
              setBubble(i, v, true);
            }
          }
          shown = tick.cells.slice();
          leftEl.textContent = String(shown.filter((x) => x > 0).length);
        }, t),
      );
    });
    timers.push(window.setTimeout(end, t + 40));
  }

  const afterTap = (): void => {
    if (!isClear(board)) return;
    winTimer = window.setTimeout(showClear, 420);
  };

  function showClear(): void {
    if (disposed) return;
    const stars = starsFor(taps, level.par);
    deps.store.record(level.id, stars, taps);
    sfx.clear();
    q('.stars').innerHTML = [0, 1, 2].map((i) => `<span class="star${i < stars ? ' on' : ''}" style="--i:${i}">★</span>`).join('');
    q('.message-moves').textContent = taps <= level.par ? `${taps} タップ — さいたん!` : `${taps} タップ（さいたん ${level.par}）`;
    msg.hidden = false;
    for (let i = 0; i < stars; i++) window.setTimeout(() => sfx.star(i), 260 + i * 320);
  }

  const doTap = (i: number): void => {
    if (!msg.hidden) return;
    if (animating) finish?.();
    const res = tap(board, i);
    if (!res) {
      sfx.nope();
      const c = cellEls[i]!;
      c.classList.remove('nope');
      void c.offsetWidth;
      c.classList.add('nope');
      return;
    }
    history.push(board);
    board = res.board;
    taps++;
    tapsEl.textContent = String(taps);
    undoBtn.disabled = false;
    clearHint();
    if (!res.popped) sfx.add(res.first[i]!);
    animate(res, i, afterTap);
  };

  const reset = (): void => {
    window.clearTimeout(winTimer);
    if (animating) finish?.();
    board = init;
    history.length = 0;
    taps = 0;
    tapsEl.textContent = '0';
    undoBtn.disabled = true;
    msg.hidden = true;
    clearHint();
    renderAll(init.cells);
  };

  const undo = (): void => {
    if (!history.length || !msg.hidden) return;
    window.clearTimeout(winTimer);
    if (animating) finish?.();
    board = history.pop()!;
    taps--;
    tapsEl.textContent = String(taps);
    undoBtn.disabled = history.length === 0;
    sfx.undo();
    clearHint();
    renderAll(board.cells);
  };

  // ---- ヒント（ソルバーは Worker で動かす） ----
  let worker: Worker | null = null;
  let reqId = 0;
  let hintCell = -1;
  let hintTimer = 0;
  function clearHint(): void {
    if (hintCell >= 0) cellEls[hintCell]?.classList.remove('hint');
    hintCell = -1;
    window.clearTimeout(hintTimer);
    reqId++; // 返事待ちを無効にする
  }
  const hint = (): void => {
    if (isClear(board) || !msg.hidden) return;
    if (animating) finish?.();
    clearHint();
    const id = ++reqId;
    toast('かんがえています…');
    worker ??= new Worker(new URL('../../hint.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; par: number | null; first: number[] }>) => {
      if (e.data.id !== reqId || disposed) return;
      if (e.data.par === null || e.data.first.length === 0) {
        toast('ここからは むずかしそう。ひとつ もどしてみよう');
        return;
      }
      toastEl.hidden = true;
      hintCell = e.data.first[0]!;
      cellEls[hintCell]!.classList.add('hint');
      hintTimer = window.setTimeout(clearHint, 4000);
    };
    worker.postMessage({ board, maxDepth: 10, id });
  };

  // ---- 入力（指を置いた瞬間に反応する） ----
  const onPointerDown = (ev: PointerEvent): void => {
    const c = (ev.target as HTMLElement).closest<HTMLElement>('.cell');
    if (!c || !boardEl.contains(c)) return;
    ev.preventDefault();
    doTap(Number(c.dataset.i));
  };
  boardEl.addEventListener('pointerdown', onPointerDown);

  const onClick = (ev: Event): void => {
    const t = ev.target as HTMLElement;
    if (t.closest('.back-btn')) deps.go({ screen: 'select' });
    else if (t.closest('.help-btn')) openHelpSheet();
    else if (t.closest('.settings-btn')) openSettingsSheet();
    else if (t.closest('.undo-btn')) undo();
    else if (t.closest('.retry-btn')) reset();
    else if (t.closest('.hint-btn')) hint();
    else if (t.closest('.next-btn') && next) deps.go({ screen: 'play', levelId: next });
    else if (t.closest('.again-btn')) reset();
    else if (t.closest('.select-btn')) deps.go({ screen: 'select' });
  };
  root.addEventListener('click', onClick);
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'z' || ev.key === 'Backspace') undo();
  };
  window.addEventListener('keydown', onKey);

  return () => {
    disposed = true;
    window.clearTimeout(winTimer);
    window.clearTimeout(toastTimer);
    window.clearTimeout(hintTimer);
    finish?.();
    worker?.terminate();
    boardEl.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
  };
}
