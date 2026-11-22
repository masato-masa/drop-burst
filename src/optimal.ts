// 最短の解を全部数える。同じ手の並べ替えは 1 つと数える（手の集合 = どのマスを何回タップするか）。
import { type Board, isClear, key, tap } from './engine.ts';

export interface OptimalSets {
  /** 最短の解の本数（並べ替えを別々に数える） */
  sequences: number;
  /** 手の集合の種類数（並べ替えは同じ） */
  sets: number;
  /** 手の集合の例（マスの番号を昇順に並べた文字列） */
  examples: string[];
}

export function optimalSets(start: Board, par: number): OptimalSets {
  const sets = new Set<string>();
  let sequences = 0;
  // 残り k 手で解けない状態は枝刈り（失敗の記録）
  const dead = new Map<string, number>(); // key -> 解けないと分かった最大の残り手数
  const rec = (b: Board, left: number, path: number[]): boolean => {
    if (isClear(b)) {
      if (left === 0) {
        sequences++;
        sets.add([...path].sort((a, c) => a - c).join(','));
        return true;
      }
      return false; // 最短より早く終わるものは最短ではない（par は最少なので起こらない）
    }
    if (left === 0) return false;
    const k = key(b);
    const d = dead.get(k);
    if (d !== undefined && d >= left) return false;
    let found = false;
    for (let i = 0; i < b.cells.length; i++) {
      if (b.cells[i]! <= 0) continue;
      const r = tap(b, i)!;
      path.push(i);
      if (rec(r.board, left - 1, path)) found = true;
      path.pop();
    }
    if (!found) dead.set(k, Math.max(d ?? 0, left));
    return found;
  };
  rec(start, par, []);
  return { sequences, sets: sets.size, examples: [...sets].slice(0, 4) };
}
