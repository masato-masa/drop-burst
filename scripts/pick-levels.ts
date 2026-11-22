// 面を選んで src/levels.json に書く。使い方:
//   node --experimental-strip-types scripts/pick-levels.ts <1 スロットの秒数>
// ワールドごとに「泡の数」と「最少タップ数 par」のスロットを決め、決定的な乱数（スロット番号がシード）で
// 候補を探して、手筋が少なく連鎖で手数が減る盤を採る。
import { readFileSync, writeFileSync } from 'node:fs';
import { makeBoard, toRows } from '../src/engine.ts';
import { solve } from '../src/solver.ts';

const SEC = Number(process.argv[2] ?? 20);
// 第 2 引数にワールド番号（1〜）を渡すと、そのワールドだけ選び直して、残りは今の src/levels.json のまま残す
const ONLY = process.argv[3] ? Number(process.argv[3]) : 0;
const W = 5;
const H = 6;
const WORLDS = [
  { name: 'はじめの しずく', nb: [2, 5], minSlack: 1, pars: [1, 1, 2, 2, 2, 3] },
  { name: 'つながる あわ', nb: [4, 7], minSlack: 2, pars: [2, 3, 3, 3, 4, 4] },
  { name: 'ふかよみ', nb: [6, 9], minSlack: 3, pars: [3, 4, 4, 5, 5, 5] },
  { name: 'ちょうせん', nb: [7, 11], minSlack: 3, maxCount: 120, pars: [5, 6, 6, 6, 7, 7] },
];
const mk = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
// 左右反転・上下反転で同じ盤になるものは 1 つとみなす
const canon = (rows: string[]) => {
  const v = [rows, rows.map((r) => [...r].reverse().join('')), [...rows].reverse(), [...rows].reverse().map((r) => [...r].reverse().join(''))];
  return v.map((x) => x.join('/')).sort()[0]!;
};
const used = new Set<string>();
const out: { name: string; levels: { id: string; rows: string[]; par: number }[] }[] = [];
let slot = 0;
const existing: { name: string; levels: { id: string; rows: string[]; par: number }[] }[] = ONLY ? JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8')) : [];
for (const [wi, w] of WORLDS.entries()) {
  if (ONLY && wi + 1 !== ONLY) {
    out.push(existing[wi]!);
    for (const l of existing[wi]!.levels) used.add(canon(l.rows));
    slot += w.pars.length;
    continue;
  }
  const levels: { id: string; rows: string[]; par: number }[] = [];
  for (const [li, par] of w.pars.entries()) {
    slot++;
    const rnd = mk(slot * 7919);
    const t0 = Date.now();
    let bestScore = -1e9;
    let best: { rows: string[]; par: number } | null = null;
    while (Date.now() - t0 < SEC * 1000) {
      const n = w.nb[0]! + Math.floor(rnd() * (w.nb[1]! - w.nb[0]! + 1));
      const cells = new Array(W * H).fill(0);
      let placed = 0;
      while (placed < n) {
        const i = Math.floor(rnd() * W * H);
        if (cells[i]) continue;
        cells[i] = 1 + Math.floor(rnd() * 3);
        placed++;
      }
      const naive = cells.reduce((a, v) => a + (v ? 4 - v : 0), 0);
      if (naive - par < w.minSlack) continue;
      const b = makeBoard(W, H, cells);
      const sol = solve(b, par + 1, 200_000);
      if (sol.par !== par || sol.count > (w.maxCount ?? 12)) continue;
      const rows = toRows(b);
      if (used.has(canon(rows))) continue;
      const score = (naive - par) * 1.5 - Math.log2(sol.count + 1) * 3 - sol.firstMoves.length;
      if (score > bestScore) {
        bestScore = score;
        best = { rows, par };
      }
    }
    if (!best) {
      console.error(`スロット ${wi + 1}-${li + 1} (par ${par}) が見つからない`);
      continue;
    }
    used.add(canon(best.rows));
    levels.push({ id: `${wi + 1}-${li + 1}`, rows: best.rows, par: best.par });
    console.log(`${wi + 1}-${li + 1} par ${par} score ${bestScore.toFixed(1)} ${best.rows.join('/')}`);
  }
  out.push({ name: w.name, levels });
}
writeFileSync(new URL('../src/levels.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('書きました');
