// ChatGPT で作った素材シート（refs/drop-sheet.png。背景はマゼンタ単色）から、素材を切り出して
// 背景を透明にし、src/assets/ に webp で書く。ずれは CSS で補正せず、ここ（と画像）で直す。
//   node scripts/slice-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'refs/drop-sheet.png';
const OUT = 'src/assets';
mkdirSync(OUT, { recursive: true });

const img = sharp(SRC).ensureAlpha();
const { width: W, height: H } = await img.metadata();
const raw = await img.raw().toBuffer();

// マゼンタらしさ m = min(r,b) - g。背景は約 255、青・黄・茶の絵は小さい。
const smooth = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const alpha = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = raw[i * 4], g = raw[i * 4 + 1], b = raw[i * 4 + 2];
  const m = Math.min(r, b) - g;
  alpha[i] = Math.round((1 - smooth(70, 170, m)) * 255);
  // にじんだ縁のマゼンタを抜く
  if (alpha[i] > 0 && m > 0) {
    const k = m * 0.5;
    raw[i * 4] = Math.max(0, r - k);
    raw[i * 4 + 2] = Math.max(0, b - k);
  }
  raw[i * 4 + 3] = alpha[i];
}

// 段ごと・列ごとに絵のある範囲を探す
const ranges = (flags) => {
  const out = [];
  let s = -1;
  for (let i = 0; i <= flags.length; i++) {
    const on = i < flags.length && flags[i];
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      if (i - s > 20) out.push([s, i]);
      s = -1;
    }
  }
  return out;
};
const colFlags = (y0, y1) => {
  const f = new Array(W).fill(false);
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 128) f[x] = true;
  return f;
};
const rowFlags = (x0, x1, y0, y1) => {
  const f = new Array(H).fill(false);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (alpha[y * W + x] > 128) f[y] = true;
  return f;
};

const rows = ranges(rowFlags(0, W, 0, H));
if (rows.length !== 2) throw new Error(`段が 2 つに分かれない: ${JSON.stringify(rows)}`);
const items = [];
for (const [y0, y1] of rows) for (const [x0, x1] of ranges(colFlags(y0, y1))) {
  const [[ty0, ty1]] = ranges(rowFlags(x0, x1, y0, y1));
  items.push({ x0, x1, y0: ty0, y1: ty1 });
}
if (items.length !== 6) throw new Error(`絵が 6 つ見つからない: ${items.length}`);

const names = [
  ['bubble1', 168],
  ['bubble2', 168],
  ['bubble3', 168],
  ['drop', 64],
  ['star', 128],
  ['logo', 420],
];
for (const [i, it] of items.entries()) {
  const [name, size] = names[i];
  const pad = 6;
  const left = Math.max(0, it.x0 - pad), top = Math.max(0, it.y0 - pad);
  const w = Math.min(W - left, it.x1 - it.x0 + pad * 2), h = Math.min(H - top, it.y1 - it.y0 + pad * 2);
  await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left, top, width: w, height: h })
    .resize({ width: size, height: size, fit: 'inside' })
    .webp({ quality: 88, alphaQuality: 95 })
    .toFile(`${OUT}/${name}.webp`);
  console.log(name, w, h);
}
