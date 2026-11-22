// 効果音は WebAudio で合成する（音声ファイルを持たない）。URL に ?mute を付けると鳴らさない。
import { settings } from './storage.ts';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const forceMute = typeof location !== 'undefined' && new URLSearchParams(location.search).has('mute');
let on = !forceMute && settings.sfx();

export const isOn = (): boolean => on;
export function setOn(v: boolean): void {
  on = v && !forceMute;
  settings.setSfx(v);
}

function audio(): AudioContext | null {
  if (!on) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      master = ctx.createGain();
      master.gain.value = 2.2;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const last: Record<string, number> = {};
const gate = (k: string, ms: number): boolean => {
  const n = performance.now();
  if (n - (last[k] ?? -1e9) < ms) return false;
  last[k] = n;
  return true;
};

function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number, lp = 0): void {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    o.connect(f).connect(g);
  } else o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

// ペンタトニック（ド レ ミ ソ ラ）。連鎖が深くなるほど音が上がる。
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760];
const buzz = (ms: number): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 無視 */
  }
};

export const sfx = {
  /** 泡をタップして水が増えた（v = 増えたあとのつぶ数 1〜3） */
  add(v: number): void {
    tone(380 + v * 90, 0.11, 'sine', 0.16, 0, 520 + v * 110);
  },
  /** 泡がはじけた。depth = 連鎖の深さ（0 から） */
  pop(depth: number): void {
    if (!gate('pop', 35)) return;
    const f = SCALE[Math.min(depth, SCALE.length - 1)]!;
    tone(f, 0.22, 'triangle', 0.16, 0, f * 1.5, 3200);
    tone(f * 2, 0.12, 'sine', 0.05, 0.02);
    buzz(8);
  },
  /** しずくが泡に着いた */
  land(): void {
    if (gate('land', 40)) tone(980, 0.05, 'sine', 0.05);
  },
  /** 泡のないマスをタップ */
  nope(): void {
    if (gate('nope', 120)) tone(170, 0.09, 'triangle', 0.09, 0, 130, 700);
  },
  undo(): void {
    if (gate('undo', 60)) tone(420, 0.08, 'sine', 0.07, 0, 300);
  },
  clear(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, 0.34, 'triangle', 0.11, i * 0.1, 0, 3400);
      tone(f * 2, 0.2, 'sine', 0.03, i * 0.1 + 0.02);
    });
    tone(1318.5, 0.6, 'sine', 0.05, 0.42);
    buzz(60);
  },
  star(i: number): void {
    tone(SCALE[2 + i * 2]!, 0.18, 'sine', 0.08);
  },
};
