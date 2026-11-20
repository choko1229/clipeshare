# PROGRESS（Clipshare側）

凡例: `[ ]` 未着手 / `[~]` 作業中 / `[x]` 完了（型検査・lint・build・テスト通過、コミット済み）。完了日とコミットを横に書く。

## Step 0: 準備
- [x] (2026-11-21, Step 0 コミット) ブランチ `feature/quickshare-api-v1` 作成。`npm.cmd ci`、`typecheck`/`lint`/`build` が現状で通ることを確認（通らなければ既存の問題として記録）→ `prisma generate` を手動実行すれば全て通過。vitest 導入
- [x] (2026-11-21, Step 0 コミット) 現行コードの確認と記録（`QUESTIONS.md` 先頭に調査メモ）: ① `POST /api/qick/upload` の処理（上限・バナー・IPハッシュ・1日上限の数え方）② `QuickShare`/AccountLevel/匿名上限の保存場所 ③ 動画の非同期処理 ④ NextAuth 設定と管理画面の構成 ⑤ テスト基盤の有無（無ければ導入案: vitest）
- [x] (2026-11-21, Step 0 コミット) API_CONTRACT.md と現行実装の差異を整理し、必要なら契約を更新（変更履歴に記載）

## Step 1: DB
- [x] (2026-11-21, Step 1 コミット) `ApiToken` モデル、認可コード用テーブル `ApiAuthorization`（Q-004）、AccountLevel の `quickShareImageMaxBytes`/`quickShareVideoMaxBytes`（Q-001/Q-002、日次は既存列を共用）、`QuickShare.apiTokenId`。監査ログは既存 `AdminAuditLog` を使う
- [x] (2026-11-21, Step 1 コミット) マイグレーション `20261121000000_add_quickshare_api_tokens`（`prisma migrate diff` で生成＋データ更新2文）。DROP/MODIFY なしを目視・テストで確認
- [x] (2026-11-21, Step 1 コミット) 画像上限 20MB→50MB の反映（既定値変更＋旧既定値のときだけ DB 値を更新、Q-003）

## Step 2: 認可とトークン（画面 07 / 13）
- [x] (2026-11-21, Step 2 コミット) 認可フロー設計メモ（NextAuth への組み込み案）→ `QUESTIONS.md` Q-005/Q-006/Q-007
- [x] (2026-11-21, Step 2 コミット) `GET /qick/authorize` 画面（接続コード表示、許可/キャンセル、CSRF対策）＋ `POST /qick/authorize/decision`、`/qick/authorize/complete`、`/login?callbackUrl`、iframe 埋め込み禁止ヘッダ
- [x] (2026-11-21, Step 2 コミット) `POST /api/v1/auth/token`、`DELETE /api/v1/auth/token`、`GET /api/v1/me`（統一エラー・構造化ログ・レート制限）
- [x] (2026-11-21, Step 2 コミット) 連携アプリ管理画面 `/settings/apps`（端末ごとの失効、今日の件数）
- [x] (2026-11-21, Step 2 コミット) テスト（PKCE不一致・state・期限・使い回し・非loopback redirect拒否・失効・BAN・CSRF・認証失敗の連続）`tests/api-auth*.test.ts`

## Step 3: アップロード/削除API
- [x] (2026-11-21, Step 3 コミット) `POST /api/v1/quick`（認証・匿名・バナー分岐・画質・上限・動画マジックバイト・レート制限・統一エラー。busboy でストリーム受信し上限を受信中に強制）
- [x] (2026-11-21, Step 3 コミット) `DELETE /api/v1/quick/{id}`（所有者・API経由のみ/匿名 X-Delete-Token。失敗は全て404）
- [x] (2026-11-21, Step 3 コミット) テスト一式（INSTRUCTIONS §8）。sharpのメタデータ除去を GPS付きEXIF＋orientation=6 の実画像で検証（`tests/media-processing.test.ts`、`tests/api-quick-routes.test.ts`）

## Step 4: OGP・共有ページ（画面 17）
- [x] (2026-11-21, Step 4 コミット) `/q/{id}/view` にOGP/Twitter Card（noindex維持。画像=og:image、動画=サムネイル+og:video、処理中・期限切れはメディアなし）
- [x] (2026-11-21, Step 4 コミット) Discord/Xでの表示確認手順を `docs/DEPLOY_QUICKSHARE.md` に記載（実機確認は人に依頼）

## Step 5: 管理画面（画面 20）
- [ ] AccountLevel のツール用上限をWebUIから変更（0=無制限）
- [ ] 管理者用トークン管理（値は非表示、失効、監査ログ）— 実装前に画面案を `QUESTIONS.md` へテキストで記載

## Step 6: DLページ・更新情報（画面 01）
- [ ] `/qick/download`（GitHub Releases最新を表示、サーバー側キャッシュ、失敗時は前回結果）
- [ ] `GET /api/v1/client/latest`

## Step 7: 仕上げ
- [ ] `docs/DEPLOY_QUICKSHARE.md`（バックアップ、`migrate deploy`、ロールバック、スモークテスト、設定値）
- [ ] セルフレビュー1回目（INSTRUCTIONS §9）→ 修正
- [ ] セルフレビュー2回目 → 修正
- [ ] `typecheck`/`lint`/`build`/テスト全通過
- [ ] `REPORT.md`（完了報告。契約の変更点、未検証項目の結果、人が行う作業）
- [ ] 作業ブランチをpush、PR作成（マージはしない）
