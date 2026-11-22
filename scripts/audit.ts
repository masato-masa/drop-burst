// 全ステージの検証: 解ける・par が最少手数と一致・盤の寸法が同じ・解の再生でクリアできる。
//   node --experimental-strip-types scripts/audit.ts
import { isClear, parseRows, tap, toRows } from '../src/engine.ts';
import { solve } from '../src/solver.ts';
import data from '../src/levels.json' with { type: 'json' };

let bad = 0;
let n = 0;
const t0 = Date.now();
for (const w of data) {
  for (const l of w.levels) {
    n++;
    const b = parseRows(l.rows);
    const s = solve(b, l.par + 1);
    const ok = s.par === l.par && b.w === 5 && b.h === 6 && toRows(b).join() === l.rows.join();
    // 解の再生: 最初の 1 手候補から貪欲に最少手数で解く
    let cur = b;
    let taps = 0;
    while (!isClear(cur) && taps < 20) {
      const sol = solve(cur, l.par - taps + 1);
      if (sol.par === null || sol.firstMoves.length === 0) break;
      const r = tap(cur, sol.firstMoves[0]!);
      if (!r) break;
      cur = r.board;
      taps++;
    }
    const replay = isClear(cur) && taps === l.par;
    if (!ok || !replay) {
      bad++;
      console.log(`NG ${l.id} par=${l.par} solver=${s.par} replay=${taps}/${isClear(cur)}`);
    } else console.log(`OK ${l.id} par=${l.par} 解 ${s.count} 通り 初手 ${s.firstMoves.length}`);
  }
}
console.log(`${n} 面中 NG ${bad}（${Date.now() - t0}ms）`);
process.exit(bad ? 1 : 0);
