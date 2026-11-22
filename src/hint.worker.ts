// ヒント用ソルバーを画面とは別のスレッドで動かす（深い盤でも画面を止めない）。
import { type Board } from './engine.ts';
import { solve } from './solver.ts';

self.onmessage = (e: MessageEvent<{ board: Board; maxDepth: number; id: number }>) => {
  const { board, maxDepth, id } = e.data;
  const s = solve(board, maxDepth, 400_000);
  (self as unknown as Worker).postMessage({ id, par: s.par, first: s.firstMoves });
};
