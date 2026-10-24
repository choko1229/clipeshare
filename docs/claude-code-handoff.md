# Claude Code 引き継ぎメモ

最終確認日: 2026-07-12  
対象リポジトリ: `C:\Users\choko1229\Documents\GitHub\clipeshare`  
ブランチ状態: `main...origin/main`、作業ツリーclean

## 現状サマリー

Clipeshareは、Next.js App Router / TypeScript / Prisma / MySQL構成のゲームクリップ・スクリーンショット共有サイトです。  
主要MVP機能はかなり実装済みです。残りは「未実装の細部」「本番・実機検証」「文字化け修正」「運用面の詰め」が中心です。

## 最優先チェックリスト

- [x] 文字化けしている日本語UI文言を修正する (2026-07-12確認: 3ファイルとも文字化けなし。リポジトリ全体を該当パターンで再検索しても他に該当なし)
  - [x] `app/c/[id]/edit/page.tsx`
  - [x] `app/c/[id]/actions.ts`
  - [x] `app/search/page.tsx`
  - [x] 他にも同様の文字化けがないか `rg "謚|繝|譁|縺|荳|髮|蜷|邱|莉"` で確認する → 該当なし
- [x] 修正後に `npm.cmd run typecheck` → 成功
- [x] 修正後に `npm.cmd run lint` → 成功
- [x] 修正後に `npm.cmd run build` → 成功

## 要件との差分 / 不足チェックリスト

### 投稿・メディア

- [x] 投稿編集画面で動画/メディア差し替えを実装する (2026-07-13)
  - CLIP: `components/posts/post-video-replace-input.tsx` で動画ファイル選択+クリッピング範囲指定 → `app/c/[id]/edit/actions.ts` で `storeOriginalVideo` → 新規 `UploadJob` (QUEUED) を作成し、投稿を一時的に `PROCESSING` に戻す。処理中の `UploadJob` が既にある場合は差し替え不可(フォーム側でdisabled、サーバー側でも二重チェック)
  - SCREENSHOT: 複数画像ファイル入力で `PostMedia` を全件差し替え(`storeScreenshotImage` → `deleteMany` + `createMany`)。アップロード上限(`getUploadLimitsForUser`)でチェック
  - typecheck/lint/build成功。**DB未接続のため実機ブラウザ確認は未実施**(動画処理は `scripts/video-worker.mjs` が実際にffmpeg処理するため、実サーバーでの動作確認が別途必要)
- [x] 動画差し替え時の旧ファイル保持・削除予約を完全化する (2026-07-13)
  - 旧HLSディレクトリ(`hlsPath`の親ディレクトリ)
  - 旧共有MP4(`shareVideoUrl`)
  - 旧サムネイル(手動サムネイル未指定時のみ、`thumbnailUrl`)
  - 旧元動画(`originalFilePath`)
  - 画像差し替え時は旧 `PostMedia` の originalPath/processedPath/thumbnailUrl も同様に登録
  - すべて `REPLACED_FILE` として `MediaRetentionFile` に登録 → 既存の `cleanup-media` cronで物理削除される想定(ロジック自体は変更していない)
- [ ] 削除済みファイルの物理削除運用を本番で確認する
  - `MediaRetentionFile`
  - `cleanup-media`
  - cron / systemd timer
- [ ] 動画クリッピングUIを本格化する
  - 現状は投稿時の `clipStartSeconds` / `clipEndSeconds` 基盤あり
  - UI/プレビュー/上限超過時の誘導は追加余地あり
- [ ] 投稿前画像圧縮の品質・スマホ互換性を確認する

### 検索

- [x] `nsfw:` 検索演算子を実装する (2026-07-12: `nsfw:true|only`→NSFWのみ、`nsfw:all|any|both`→両方含む、未指定→従来通りSFWのみ。`lib/search/parse-query.ts` / `app/search/page.tsx`)
- [x] `rank:` 検索演算子を実装する (2026-07-12: `Post.rankName` の部分一致)
- [x] `server:` 検索演算子を実装する (2026-07-12: `Post.discordServerName` の部分一致)
  - 注意: DB未接続のためブラウザでの実機動作確認は未実施。typecheck/lint/buildは成功確認済み
- [ ] 検索専用基盤を入れるか判断する
  - MySQL FULLTEXT
  - Meilisearch
  - Typesense
  - まずはPrisma `contains` 継続でも可

### プロフィール

- [ ] 外部リンクの実データ表示を本番で確認する
  - YouTube oEmbed
  - X oEmbed相当
  - GitHub public API
  - Misskey public API
  - Discord invite API
  - `UserLinkMeta` 24時間DBキャッシュ
- [ ] 外部API失敗時の表示を実リンクで確認する
- [ ] プロフィール横スクロールが実機幅で再発しないか確認する
- [ ] プロフィールテーマ上書きがライト/ダーク/System/PWAで破綻しないか確認する

### PWA / スマホ

- [ ] iPhone/iPad実機でPWAインストール導線を確認する
- [ ] Android実機でPWAインストール導線を確認する
- [ ] iOS PWAでヘッダーがsafe-area外に出ないか確認する
- [ ] iOS PWAのLiquid Glass風UIで文字が読めるか確認する
- [ ] PWA時の拡大抑制が入力操作を邪魔しないか確認する
- [ ] Service Worker更新後にCSS/JSキャッシュが古いまま残らないか確認する

### 共有 / OGP

- [x] コードレビューで実際のバグを発見・修正 (2026-07-13): `app/c/[id]/page.tsx` の `generateMetadata` が `twitter.card` を常に `summary_large_image` にしつつ `other` で `twitter:card: "player"` も出力しており、動画投稿で `<meta name="twitter:card">` が2つの矛盾した値で重複出力されていた(`og:video`系も`openGraph.videos`と`other`で二重出力)。Next.js公式の `twitter.card:"player"` + `players` フィールドに置き換えて解消。typecheck/lint/build成功
- [ ] Discordに `/c/{ID}` を貼ったときの表示を本番で確認する(上記修正後、要実機確認)
  - タイトル
  - 説明
  - サムネイル
  - 再生ボタン
  - `og:video`
- [ ] Xでカード表示を確認する(上記修正後、要実機確認)
- [ ] X用MP4ダウンロードから手動投稿した見た目を確認する(要実機確認)
- [x] 既存動画で `shareVideoUrl` が無い投稿の再生成方針を決める (2026-07-13)
  - 方針: `npm run requeue:share-video` (新規 `scripts/requeue-missing-share-video.mjs`) で対象投稿(CLIP・PUBLISHED・`shareVideoUrl`なし・元動画ファイルが残っている・処理中ジョブなし)に新規`UploadJob`をQUEUEDで登録 → `npm run worker` が拾って再エンコード
  - 元動画ファイルが保持期限切れで物理削除済みの投稿は対象外(再アップロードが必要)。`--dry-run` で事前確認可能
- [x] `/api/oembed?url=...` を公開APIとして作るか判断する (2026-07-13): 作成する方針。`app/api/oembed/route.ts` を新規実装(video/photo type、`maxwidth`/`maxheight`対応)。`app/c/[id]/page.tsx` に `<link rel="alternate" type="application/json+oembed">` の自動検出リンクも追加

### 通知

- [ ] Web Pushを本番で確認する
  - VAPID env
  - iOS PWA
  - Android Chrome
  - デスクトップChrome/Edge
- [ ] 通知設定を細分化するか判断する
  - コメント
  - 返信
  - いいね
  - フォロー
  - メンション
- [ ] メンション通知の仕様を決める

### ゲーム情報

- [ ] IGDB同期を本番envで確認する
- [ ] Steam同期を本番で確認する
- [ ] RAWG同期を本番envで確認する
  - `RAWG_API_KEY` が必要
- [ ] YouTube風ゲームまとめの外部情報集約を設計する
  - YouTube Data APIを使うか
  - 外部動画/ニュースを集約するか
  - まずサイト内投稿だけで十分か

### 管理・モデレーション

- [ ] 禁止コンテンツ判断基準を管理者向けに詳細化する
  - 犯罪系
  - 個人情報
  - ハラスメント
  - NSFW境界
- [ ] Nuisance適用基準を文書化する
- [ ] BAN基準を文書化する
- [ ] NGワード初期セットを運用しながら拡張する
- [ ] 通報対応フローを管理者向けに整理する

### 本番運用確認

- [ ] GitHub Actions deployが最新mainで成功する
- [ ] `https://clipshare.link/api/health` が成功する
- [ ] Next.js app serviceが起動している
- [ ] video worker serviceが起動している
- [ ] Nginxが `/_next/static` と `/media` を正しく返す
- [ ] FFmpegが本番で実行できる
- [ ] 大容量アップロード制限がNginx/Node/アプリで一致している
- [ ] サーバー容量とメディア保存先を監視できる
- [ ] SMTPメールリンクログインが届く
- [ ] Discord OAuthログインが通る

## Claude Codeへの依頼文

```text
あなたは C:\Users\choko1229\Documents\GitHub\clipeshare を引き継ぐClaude Codeです。

このプロジェクトは、ゲームクリップ/スクリーンショット共有サイト「Clipshare」です。
Next.js App Router / TypeScript / Tailwind CSS / Prisma / MySQL / Auth.js / FFmpeg / HLS 構成です。

まず以下を守ってください。

1. 既存実装を勝手に大きく作り替えないでください。
2. 未確認の仕様は質問して、許可を得てから作業してください。
3. 作業前に `git status --short --branch` を確認してください。
4. 文字化けしている日本語UI文言を最優先で直してください。
5. 修正後は必ず以下を実行してください。
   - npm.cmd run typecheck
   - npm.cmd run lint
   - npm.cmd run build
6. 変更内容をまとめて、必要ならコミット/プッシュ前に確認してください。

現在の最優先タスク:

- `app/c/[id]/edit/page.tsx`
- `app/c/[id]/actions.ts`
- `app/search/page.tsx`

上記に日本語の文字化けがあります。
`謚`, `繝`, `譁`, `縺`, `荳`, `髮`, `蜷`, `邱`, `莉` などの文字が残っていないか検索し、UI表示文言とエラーメッセージを自然な日本語に戻してください。

その後、以下の残タスクから優先度順に進めてください。

1. 投稿編集画面の動画/メディア差し替え実装
2. 差し替え時の旧ファイル保持・削除予約
3. 検索演算子 `nsfw:` / `rank:` / `server:`
4. PWA/iOS/Android実機確認で出た不具合修正
5. Discord/X共有プレビューの本番確認と修正
6. Web Push本番確認と通知設定細分化
7. 管理者向けモデレーション運用基準の文書化

参考ファイル:

- docs/overall-design.md
- docs/implementation-status.md
- docs/claude-code-handoff.md
- docs/release-checklist.md
- prisma/schema.prisma
- app/c/[id]/edit/page.tsx
- app/c/[id]/actions.ts
- app/search/page.tsx
- lib/search/parse-query.ts
- lib/media/retention.ts
- scripts/cleanup-media.mjs

注意:

docs/implementation-status.md は一部古い可能性があります。
コード上では Steam/RAWG同期、UserLinkMetaによる外部リンクメタキャッシュ、Web Push、/v 縦動画ページなどが進んでいます。
必ず現在のコードを確認してから判断してください。
```

