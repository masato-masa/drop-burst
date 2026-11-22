# しずくバースト（drop-burst）

**▶ あそぶ: https://masato-masa.github.io/drop-burst/**

泡をタップして水を 1 つぶ足す。4 つぶになると泡がはじけて、上下左右へしずくが飛ぶ。
しずくは泡に当たるまでまっすぐ進み、当たった泡に 1 つぶ足す。泡を全部消したらクリア。
連鎖をうまく起こして、少ないタップで消すほど ★ が増える。

Claude が 0 から考えたゲーム（2 作目）。設計の根拠は Obsidian の `Projects/drop-burst.md`。

## 開発

```bash
npm install
npm run dev        # http://localhost:5260/
npm test           # 全 24 面を検証（解ける・par が最少手数と一致・再生でクリア）
npm run levels     # 面の候補を探す（scripts/gen-levels.ts）
node --experimental-strip-types scripts/pick-levels.ts 25   # 面を選び直して src/levels.json を書く
npm run deploy     # GitHub Pages（gh-pages ブランチ）へ公開
```

- 規則の正本は `src/engine.ts` の冒頭コメント。ソルバーは `src/solver.ts`（幅優先、盤の文字列で状態を畳む）。
- 面は `src/levels.json`（5×6 固定）。`scripts/pick-levels.ts` が、連鎖で手数が減る盤だけをスロット番号をシードにして決定的に選ぶ。
- 共通 UI は `shared-ui` から `node shared-ui/sync.mjs` で配られる（`src/styles/shared/` と `src/ui/shared/` は生成物。直接編集しない）。
- 効果音は WebAudio で合成（`src/ui/sfx.ts`）。`?mute` を付けると鳴らさない。
