// 山登り法で「最短の解がただ 1 通り（初手も 1 つ）」の盤を探す。使い方:
//   node --experimental-strip-types scripts/climb-levels.ts <秒> <par> <最小泡数> <最大泡数> <シード>
// 乱数の盤から出発して、泡を動かす・値を変える・足す・消すを繰り返し、
// 「par が目標どおり」「解が少ない」「連鎖で手数が減る」ほど高得点にして残す。
import { makeBoard, toRows } from '../src/engine.ts';
import { solve } from '../src/solver.ts';

const [SEC = 30, PAR = 4, MINB = 5, MAXB = 7, SEED = 1] = process.argv.slice(2).map(Number);
const W = 5;
const H = 6;
let s = (SEED * 2654435761) >>> 0 || 1;
const rnd = () => {
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return s / 4294967296;
};
const ri = (n: number) => Math.floor(rnd() * n);

function evalBoard(cells: number[]): { score: number; par: number | null; count: number; first: number } {
  const n = cells.filter((v) => v).length;
  if (n < MINB || n > MAXB) return { score: -1e9, par: null, count: 0, first: 0 };
  const sol = solve(makeBoard(W, H, cells), PAR + 1, 120_000);
  if (sol.par === null) return { score: -1e8, par: null, count: 0, first: 0 };
  const naive = cells.reduce((a, v) => a + (v ? 4 - v : 0), 0);
  const slack = naive - sol.par;
  // par が目標からずれると大きく減点。解が少ない・初手が少ない・連鎖で減るほど加点。
  const score = -Math.abs(sol.par - PAR) * 40 - Math.log2(sol.count) * 6 - (sol.firstMoves.length - 1) * 8 + Math.min(slack, 8) * 1.5;
  return { score, par: sol.par, count: sol.count, first: sol.firstMoves.length };
}

const t0 = Date.now();
let best: { cells: number[]; score: number; par: number | null; count: number; first: number } = { cells: new Array(W * H).fill(0), score: -1e12, par: 0, count: 0, first: 0 };
while (Date.now() - t0 < SEC * 1000) {
  // 出発点
  let cells = new Array(W * H).fill(0);
  const n0 = MINB + ri(MAXB - MINB + 1);
  for (let k = 0; k < n0; ) {
    const i = ri(W * H);
    if (!cells[i]) {
      cells[i] = 1 + ri(3);
      k++;
    }
  }
  let cur = evalBoard(cells);
  for (let it = 0; it < 150 && Date.now() - t0 < SEC * 1000; it++) {
    const c2 = cells.slice();
    const op = ri(4);
    const filled = c2.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    const empty = c2.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (op === 0) c2[filled[ri(filled.length)]!] = 1 + ri(3);
    else if (op === 1) {
      const f = filled[ri(filled.length)]!;
      const e = empty[ri(empty.length)]!;
      c2[e] = c2[f]!;
      c2[f] = 0;
    } else if (op === 2 && filled.length < MAXB) c2[empty[ri(empty.length)]!] = 1 + ri(3);
    else if (op === 3 && filled.length > MINB) c2[filled[ri(filled.length)]!] = 0;
    else continue;
    const e2 = evalBoard(c2);
    if (e2.score >= cur.score) {
      cells = c2;
      cur = e2;
    }
  }
  if (cur.score > best.score) best = { cells, ...cur };
}
console.log(JSON.stringify({ par: best.par, count: best.count, first: best.first, score: +best.score.toFixed(1), rows: toRows(makeBoard(W, H, best.cells)) }));
