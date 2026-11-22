// しずくバーストのソルバー。最少タップ数と、その解を数える。
import { type Board, isClear, key, tap } from './engine.ts';

export interface Solution {
  /** 最少タップ数。maxDepth までに解けなければ null */
  par: number | null;
  /** 最少タップの解の最初の 1 手（index）の候補 */
  firstMoves: number[];
  /** 最少タップの解の本数（上限 cap で打ち切る） */
  count: number;
  /** 探索した状態数 */
  visited: number;
}

/** 幅優先で最少タップ数を求める（状態は盤の文字列で畳む）。 */
export function solve(start: Board, maxDepth: number, stateCap = 3_000_000): Solution {
  if (isClear(start)) return { par: 0, firstMoves: [], count: 1, visited: 1 };
  // 各状態: 最短タップ数と、そこへ至る最短経路の本数
  let frontier = new Map<string, { board: Board; ways: number; first: Set<number> }>();
  frontier.set(key(start), { board: start, ways: 1, first: new Set() });
  const seen = new Set<string>([key(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const nextF = new Map<string, { board: Board; ways: number; first: Set<number> }>();
    for (const { board, ways, first } of frontier.values()) {
      for (let i = 0; i < board.cells.length; i++) {
        if (board.cells[i] === 0) continue;
        const r = tap(board, i);
        if (!r) continue;
        const k = key(r.board);
        if (seen.has(k) && !nextF.has(k)) continue;
        const f = depth === 1 ? new Set([i]) : first;
        const cur = nextF.get(k);
        if (cur) {
          cur.ways += ways;
          for (const x of f) cur.first.add(x);
        } else nextF.set(k, { board: r.board, ways, first: new Set(f) });
      }
    }
    if (nextF.size === 0) return { par: null, firstMoves: [], count: 0, visited: seen.size };
    const clear = [...nextF.values()].filter((s) => isClear(s.board));
    if (clear.length) {
      const first = new Set<number>();
      let count = 0;
      for (const c of clear) {
        count += c.ways;
        for (const x of c.first) first.add(x);
      }
      return { par: depth, firstMoves: [...first].sort((a, b) => a - b), count, visited: seen.size };
    }
    for (const k of nextF.keys()) seen.add(k);
    if (seen.size > stateCap) return { par: null, firstMoves: [], count: 0, visited: seen.size };
    frontier = nextF;
  }
  return { par: null, firstMoves: [], count: 0, visited: seen.size };
}

/** いまの盤からの最少タップ数（ヒント用）。解けなければ null。 */
export const parOf = (b: Board, maxDepth = 12): number | null => solve(b, maxDepth).par;
