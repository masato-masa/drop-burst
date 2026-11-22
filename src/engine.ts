// しずくバーストの規則（純粋な TS。DOM を import しない）。
//
// - 盤は w × h のマス。泡のあるマスには水が 1〜3 つぶ入っている。泡のないマスは空。
// - 泡をタップすると水が 1 つぶ増える。4 つぶになると泡がはじけ、上下左右へしずくが 1 つずつ飛ぶ。
// - しずくは 1 ティックに 1 マス進む。空のマスはそのまま通り抜け、泡に当たると水が 1 つぶ増えて消える。
//   盤の外へ出たしずくは消える。
// - 同じティックにしずくが着いた泡は、全部足してから判定する（4 つぶ以上ではじける）。
// - 大きい泡（水の量を a〜g の文字で書く）は 8 つぶではじける。しずくは 1 つぶずつたまる。
// - 石（-1）はしずくをさえぎる。しずくは石に当たると消える。石はタップできず、はじけない。
// - 鏡（スラッシュ = -2、バックスラッシュ = -3）はしずくの向きを 90 度かえる。しずくは鏡のマスを出て、新しい向きに進む。鏡はタップできない。
//   （鏡で輪になって止まらないしずくは、40 マス進んだら消える。）
// - 泡が全部なくなったらクリア。タップの回数が少ないほど星が多い。

export const CAP = 4;
/** 大きい泡（文字 a〜g = 水 1〜7 つぶ。内部の値は 10 + つぶ数）は 8 つぶではじける */
export const BIG = 10;
export const BIG_CAP = 8;
export const capOf = (v: number): number => (v >= BIG ? BIG + BIG_CAP : CAP);

export interface Board {
  w: number;
  h: number;
  /** -1 = 石、0 = 空、1〜3 = 水のつぶ数。index = y * w + x */
  cells: number[];
}

/** 1 ティックぶんのしずくの動き。from → to（to = -1 は盤の外へ出た）。 */
export interface Flight {
  from: number;
  to: number;
  dir: 0 | 1 | 2 | 3; // 上 下 左 右
  /** 着いたマス（泡）の index。空を通り過ぎただけなら -1。石に当たって消えたら -2。鏡で向きが変わったら -3 */
  hit: number;
}

export interface Tick {
  flights: Flight[];
  /** このティックの終わり（はじけたあと）の盤 */
  cells: number[];
  /** このティックの終わりにはじけた泡 */
  pops: number[];
}

export interface TapResult {
  board: Board;
  /** タップで水が増えた直後（まだしずくは飛んでいない。はじけたマスは 0）の盤 */
  first: number[];
  /** タップで増えた直後にはじけたか（= 最初のはじけ） */
  popped: boolean;
  ticks: Tick[];
  /** はじけた泡の総数 */
  pops: number;
}

const DX = [0, 0, -1, 1];
const DY = [-1, 1, 0, 0];

export const makeBoard = (w: number, h: number, cells: number[]): Board => ({ w, h, cells });

export const parseRows = (rows: string[]): Board => {
  const h = rows.length;
  const w = rows[0]!.length;
  const cells: number[] = [];
  for (const r of rows) for (const c of r) cells.push(c === '.' ? 0 : c === '#' ? -1 : c === '/' ? -2 : c === '\\' ? -3 : c >= 'a' && c <= 'g' ? BIG + (c.charCodeAt(0) - 96) : Number(c));
  return { w, h, cells };
};

export const toRows = (b: Board): string[] => {
  const out: string[] = [];
  for (let y = 0; y < b.h; y++) out.push(b.cells.slice(y * b.w, (y + 1) * b.w).map((v) => (v === -1 ? '#' : v === -2 ? '/' : v === -3 ? '\\' : v >= BIG ? String.fromCharCode(96 + v - BIG) : v ? String(v) : '.')).join(''));
  return out;
};

export const key = (b: Board): string => b.cells.join('');
export const bubblesLeft = (b: Board): number => b.cells.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
export const isClear = (b: Board): boolean => b.cells.every((v) => v <= 0);
export const waterLeft = (b: Board): number => b.cells.reduce((n, v) => n + Math.max(0, v), 0);

/** タップ。泡のないマスは null（手数を使わない）。 */
export function tap(b: Board, idx: number): TapResult | null {
  if (idx < 0 || idx >= b.cells.length || b.cells[idx]! <= 0) return null;
  const cells = b.cells.slice();
  const ticks: Tick[] = [];
  let pops = 0;
  cells[idx]! += 1;
  type Drop = { x: number; y: number; dir: 0 | 1 | 2 | 3; life: number };
  let droplets: Drop[] = [];
  const burst = (i: number) => {
    cells[i] = 0;
    pops++;
    const x = i % b.w;
    const y = Math.floor(i / b.w);
    for (const dir of [0, 1, 2, 3] as const) droplets.push({ x, y, dir, life: 40 });
  };
  const popped = cells[idx]! >= capOf(cells[idx]!);
  if (popped) burst(idx);
  const first = cells.slice();
  while (droplets.length) {
    const flights: Flight[] = [];
    const next: Drop[] = [];
    const touched = new Set<number>();
    for (const d of droplets) {
      const from = d.y * b.w + d.x;
      const nx = d.x + DX[d.dir]!;
      const ny = d.y + DY[d.dir]!;
      if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h) {
        flights.push({ from, to: -1, dir: d.dir, hit: -1 });
        continue;
      }
      const to = ny * b.w + nx;
      if (cells[to]! === -1) {
        flights.push({ from, to, dir: d.dir, hit: -2 });
      } else if (cells[to]! < -1) {
        // 鏡: 向きをかえて、次のティックからそちらへ進む
        const nd = (cells[to] === -2 ? [3, 2, 1, 0] : [2, 3, 0, 1])[d.dir]! as 0 | 1 | 2 | 3;
        flights.push({ from, to, dir: d.dir, hit: -3 });
        if (d.life > 0) next.push({ x: nx, y: ny, dir: nd, life: d.life - 1 });
      } else if (cells[to]! > 0) {
        cells[to]! += 1;
        touched.add(to);
        flights.push({ from, to, dir: d.dir, hit: to });
      } else {
        flights.push({ from, to, dir: d.dir, hit: -1 });
        if (d.life > 0) next.push({ x: nx, y: ny, dir: d.dir, life: d.life - 1 });
      }
    }
    droplets = next;
    const popList: number[] = [];
    for (const i of [...touched].sort((a, b2) => a - b2)) if (cells[i]! >= capOf(cells[i]!)) popList.push(i);
    for (const i of popList) burst(i);
    ticks.push({ flights, cells: cells.slice(), pops: popList });
  }
  return { board: { w: b.w, h: b.h, cells }, first, popped, ticks, pops };
}
