// 面の候補を探す。使い方:
//   node --experimental-strip-types scripts/gen-levels.ts <秒> <シード> [最小泡数] [最大泡数]
// 5×6 の盤にランダムに泡を置き、ソルバーで最少タップ数・解の本数を測って、par ごとに
// 「解が少なく（手筋が一つに絞られ）、連鎖で手数が減る」盤を残す。採否は人が決める。
import { parseRows, toRows, waterLeft, bubblesLeft, makeBoard } from '../src/engine.ts';
import { solve } from '../src/solver.ts';

const [SEC = 60, SEED = 1, MINB = 3, MAXB = 9] = process.argv.slice(2).map(Number);
const W = 5;
const H = 6;
let s = SEED >>> 0 || 1;
const rnd = () => {
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return s / 4294967296;
};
const t0 = Date.now();
interface Cand {
  rows: string[];
  par: number;
  count: number;
  first: number;
  slack: number;
  bubbles: number;
  score: number;
}
const best = new Map<number, Cand[]>();
let tried = 0;
while (Date.now() - t0 < SEC * 1000) {
  const n = MINB + Math.floor(rnd() * (MAXB - MINB + 1));
  const cells = new Array(W * H).fill(0);
  let placed = 0;
  while (placed < n) {
    const i = Math.floor(rnd() * W * H);
    if (cells[i]) continue;
    cells[i] = 1 + Math.floor(rnd() * 3);
    placed++;
  }
  const b = makeBoard(W, H, cells);
  tried++;
  const sol = solve(b, 9, 250_000);
  if (sol.par === null || sol.par === 0) continue;
  const naive = cells.reduce((a, v) => a + (v ? 4 - v : 0), 0);
  const slack = naive - sol.par;
  // 手筋が少なく（count 小）、連鎖で大きく手数が減る盤ほど高得点
  const score = slack * 2 - Math.log2(sol.count + 1) * 3 - sol.firstMoves.length * 0.5;
  const c: Cand = { rows: toRows(b), par: sol.par, count: sol.count, first: sol.firstMoves.length, slack, bubbles: bubblesLeft(b), score };
  const arr = best.get(sol.par) ?? [];
  arr.push(c);
  arr.sort((a, b2) => b2.score - a.score);
  if (arr.length > 12) arr.length = 12;
  best.set(sol.par, arr);
}
console.log(`tried ${tried}`);
for (const p of [...best.keys()].sort((a, b) => a - b)) {
  console.log(`--- par ${p}`);
  for (const c of best.get(p)!) console.log(JSON.stringify({ rows: c.rows, count: c.count, first: c.first, slack: c.slack, b: c.bubbles, score: +c.score.toFixed(1) }));
}
void parseRows;
void waterLeft;
