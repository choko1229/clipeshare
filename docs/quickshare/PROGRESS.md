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
- [x] (2026-11-21, Step 5 コミット) AccountLevel のクイック共有上限を `/admin/quick-share`（画面20）から変更（0=無制限、空欄=サイト設定）。サイト全体設定を MB 入力に変更
- [x] (2026-11-21, Step 5 コミット) 管理者用トークン管理 `/admin/api-tokens`（値は非表示、失効、監査ログ）＋ Clipshare Quick 連携の設定（発行の緊急停止・レート制限・配布元）。画面案は Q-011

## Step 6: DLページ・更新情報（画面 01）
- [x] (2026-11-21, Step 6 コミット) `/qick/download`（画面01。GitHub Releases最新を表示、サーバー側キャッシュ＝メモリTTL＋DB永続、失敗時は前回結果、1分バックオフ）
- [x] (2026-11-21, Step 6 コミット) `GET /api/v1/client/latest`（同じキャッシュ。未取得時 503）

## Step 7: 仕上げ
- [x] (2026-11-21, Step 7 コミット) `docs/DEPLOY_QUICKSHARE.md`（バックアップ、`migrate deploy`、nginx、設定値、スモークテスト、OGP確認、緊急停止、ロールバック＝MySQL 8.4 で検証済み、監視）
- [x] (2026-11-21, `3671583`) セルフレビュー1回目（INSTRUCTIONS §9）→ 修正（Prisma エラーのログ出力を名前/コードのみに、契約の文字種明記、X-Forwarded-For 偽装を Q-017 に記録）。実ブラウザ＋MySQL 8.4 の通し確認で Referrer-Policy の不具合を発見・修正（`90c9cf0`）
- [x] (2026-11-21, `c89787f`) セルフレビュー2回目（独立レビュー）→ 修正（REPORT §9）
- [x] (2026-11-21) `typecheck`/`lint`/`build`/テスト全通過（175件）
- [x] (2026-11-21) `REPORT.md`（完了報告。契約の変更点、未検証項目の結果、人が行う作業）
- [x] (2026-11-21) 作業ブランチをpush、PR作成（マージはしない）

## 追加作業（2026-11-21 オーナー回答の反映）
決定事項は `QUESTIONS.md`「オーナー回答（2026-11-21）の反映メモ」を参照。

### A. `/api/v1/client/latest` の sha256 を必ず返す（API 契約 v1.2）
- [x] null になる経路の洗い出し（v1.1 時点）: ① GitHub の asset に `digest` が無い → `sha256: null`、② DB に残した前回結果（v1.1 形式）が null を含む → そのまま返る、③ `.appinstaller` など配布物以外の asset も null のまま返していた
- [x] `SHA256SUMS` を GitHub Releases から取得・解析（`lib/quick-client/checksums.ts`）→ 手動登録（`QuickClientAssetChecksum`、管理画面「連携トークン › 配布ファイルの SHA-256」）→ 揃わないリリースは配信しない（直近3件まで遡る → 前回配信分 → 503）。GitHub の digest は照合のみ（Q-021）
- [x] 取得先は GitHub の許可ホストの https のみ（リダイレクト先も毎回検査、最大3回）、サイズ上限（一覧 2MB / SHA256SUMS 64KB）、タイムアウト 5秒、キャッシュ（TTL は管理画面設定、失敗時1分バックオフ、DB 永続）、詳細ログ（`quick_client.*`）（`lib/quick-client/github-fetch.ts`、`releases.ts`）
- [x] マイグレーション `20261121010000_add_quick_client_asset_checksums`（追加のみ）
- [x] API_CONTRACT v1.2（sha256 は常に非 null、503 の条件、リリースワークフローへの要件）
- [x] vitest（正常・SHA256SUMS 欠落・形式不正・一部欠落・取得失敗・手動登録・SSRF 拒否・リダイレクト先拒否・サイズ上限・タイムアウト・digest 不一致・旧形式キャッシュの無視・キャッシュ・下書き/プレリリース除外）`tests/quick-client-releases.test.ts`

### B. nginx の X-Forwarded-For 上書き
- [x] `docs/DEPLOY_QUICKSHARE.md` §4 に変更内容・理由（CDN なし）・変更前後の挙動・反映手順・確認コマンド・ロールバックを記載。新規構築用テンプレート `scripts/install-ubuntu-24.sh` も変更
- [x] アプリ側の点検結果と改善案を `QUESTIONS.md` Q-025 に記録
- [ ] **本番 nginx への適用（オーナー）**

### C. 403（BAN）の案内先
- [x] **403案内先URL: `https://clipshare.link/contact`**（`app/contact/page.tsx`。ログイン不要・BAN ユーザーも送信可）。API_CONTRACT の 403 行に明記。BAN 用の種別は無い（Q-024）

### D. ダウンロードページ（`/qick/download`）の拡張 — **デザイン更新待ち**
デザイン01（`design/01-web-download-page.dc.html`）には該当区画が無い。キャンバス更新後に画面を実装する。今回はデータの準備まで（`lib/quick-client/download-page-data.ts` の `getDownloadPageData()`。現在の画面もこれを使うが表示は変えていない）。
- [ ] 自己署名証明書の信頼手順（ステップ形式） — デザイン更新待ち
  - 必要な要素: 見出し、手順（番号・短い見出し・必要なら1文）の並び、証明書のフィンガープリント（SHA-256、`AB:CD:…`）、配布ファイルの SHA-256（照合用）
  - データ: `certFingerprint`（管理画面「Clipshare Quick 連携の設定 › 署名証明書のフィンガープリント」で設定、未設定なら null）、`release.installerName` / `installerSha256`。手順の文言はデザインで確定してから入れる
- [ ] 更新履歴（リリース一覧） — デザイン更新待ち
  - 必要な要素: 見出し、各リリースのバージョン・公開日・リリースノート・GitHub のリリースページへのリンク
  - データ: `history`（GitHub Releases の公開リリース最大10件、新しい順。下書き・プレリリース除外。`/api/v1/client/latest` と同じキャッシュ。失敗時は前回の結果を DB から）
  - 未定事項: リリースノートの表示形式（GitHub の本文は Markdown。プレーンテキストで出すか描画するか）、表示件数
- [x] ダウンロードボタンはセットアップ exe を優先に変更済み（Q-022。見た目は不変）

## 追加作業（2026-11-21 オーナー回答2回目の反映）
- [x] Q-021〜Q-024 を確認済みに更新（お問い合わせ URL `https://clipshare.link/contact` で確定。Publisher 名 `CN=choko1229`）
- [x] 証明書フィンガープリントの入力欄: 検証を「64桁の16進（区切りなし）」か「2桁ずつコロン区切り32組」の2形式だけに厳格化（以前はコロン・空白を位置に関係なく取り除いていた）。Windows の「拇印」（SHA-1・40桁）は専用のエラーで拒否。入力例として placeholder `AB:CD:EF:…:89` のみ追加（説明文は足していない）。取得手順（PowerShell / openssl）を DEPLOY §5 に記載し、`CN=choko1229` のテスト証明書で値が一致することを確認
- [x] API_CONTRACT v1.2 に「SHA256SUMS の形式」の節を追加（単独で読める仕様。生成コマンドは Git Bash の `sha256sum` と PowerShell の両方で出力し、実際の解析処理で読めることを確認）
- [x] 解析を契約に合わせて厳格化: ファイル名はアセット名と完全一致（パス不可）、重複は値が同じでも不可、アセットに無いファイル名の行があれば配信しない、`SHA256SUMS` が不正なら手動登録でも上書きしない
- [x] テスト: CRLF・末尾/途中の空行・行末の空白・BOM・`*` 付き・大文字の16進・重複（同値/異値）・64桁でない値（63/65桁・非16進）・区切り違い（空白1つ/タブ/行頭の空白/BSD 形式）・パス付き・アセットに無いファイル名・不正な `SHA256SUMS` と手動登録の組み合わせ・フィンガープリントの形式（`tests/quick-client-releases.test.ts`、`tests/cert-fingerprint.test.ts`）
