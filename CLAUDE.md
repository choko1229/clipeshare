# CLAUDE.md（clipeshare）

Next.js (App Router) / TypeScript / Prisma (MySQL) / NextAuth のゲームクリップ・スクリーンショット共有サイト。

## 進行中のプロジェクト: Clipshare Quick（Windowsクライアント向けAPI・画面の追加）
作業の前に必ず読む（この順）: `docs/quickshare/README.md` → `SPEC.md` → `API_CONTRACT.md` → `INSTRUCTIONS.md` → `PROGRESS.md` → `QUESTIONS.md`。
既存の `docs/claude-code-handoff.md` ほか既存docsは別件の記録。混同しない。

## 標準の開発ルール（常に適用）
- DBで管理できる設定はDBに置き、WebUI（管理画面）から変更可能にする。`.env` は最小限。
- APIとUIを分離する。TypeScript `strict`、`any` 禁止、入力はスキーマ検証。
- エラー処理・例外処理・詳細ログを実装する。**ログにトークン、Authorization、ファイルの中身を出さない。**
- セキュリティ重視。保守性・可読性・拡張性を最優先。品質を速度より優先し、妥協しない。
- 既存のWeb側（Cookieセッション経由）の挙動は変えない。回帰させない。
- 仕様に無い機能を足さない。UIに動作説明の文章を足さない（デザインにある文言のみ）。
- 完成後に複数回セルフレビューする（INSTRUCTIONS §9）。

## 自走ルール
- 質問で止まらない。仕様の穴は `QUESTIONS.md` に「質問・採用した暫定案・影響範囲」を書き、**最も安全で後から直しやすい案**で先へ進む。`SPEC.md` の確定事項に反する案は採らない。
- 止まってよいのは、取り消せない操作だけ: 本番DB・本番サーバーへの操作、`main` への push/マージ、課金、秘密情報の入力が必要な操作、破壊的なDB変更。これらは行わず、手順書を作って報告する。
- 作業は `PROGRESS.md` のチェックリスト順に進め、1項目ごとに更新してコミットする。中断しても `PROGRESS.md` から再開できる状態に保つ。
- 各項目の完了条件: 型検査 `npm run typecheck`、`npm run lint`、`npm run build`（`next build --webpack`）、テストが通ること。通らなければ直す。通らないまま次へ進まない。
- コマンド（Windows）: PowerShell では `npm.cmd` を使う。DB接続が無い環境でも進める（下記）。

## ブランチ・コミット
- `main` へ直接コミットしない。作業ブランチ `feature/quickshare-api-v1` を使い、論理単位でコミット（Conventional Commits、日本語可）。pushは作業ブランチのみ可。PR作成は可、マージはしない。
- Prismaマイグレーションは追加のみ。DBが無い環境では `prisma migrate dev` が使えないため `prisma migrate diff --from-schema-datamodel`（または `--from-migrations` ＋shadow DB）で SQL を生成し、`prisma/migrations/<timestamp>_<name>/migration.sql` を作る。**本番では `prisma migrate deploy` のみ**（`migrate dev`/`db push` 禁止）。

## コミットメッセージの末尾
Co-Authored-By: Claude <noreply@anthropic.com>
