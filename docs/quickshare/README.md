# Clipshare Quick — Clipshare側の作業パック

このディレクトリは、Claude Code が自走して Clipshare 側の改修を終えるための資料一式。

| ファイル | 内容 |
|---|---|
| `SPEC.md` | 確定仕様（変更不可。変更したい場合は QUESTIONS.md） |
| `API_CONTRACT.md` | クライアントとのAPI契約（Clipshare側が正本） |
| `INSTRUCTIONS.md` | 実装指示（手順・チェック・レビュー・テスト） |
| `PROGRESS.md` | 進捗チェックリスト（自走の起点。常に更新） |
| `QUESTIONS.md` | 暫定判断と質問の記録 |
| `design/` | 画面デザインのスナップショット（Web画面は 01・07・13・17・20） |

## 自走の手順
1. `CLAUDE.md` と上の資料を読む。ブランチ `feature/quickshare-api-v1` を作る。
2. `PROGRESS.md` の未完了を上から実行。各項目: 実装→テスト→型/lint/build→PROGRESS更新→コミット。
3. 不明点は `QUESTIONS.md` に書いて暫定案で進む。取り消せない操作は行わず手順書にする。
4. 全項目後にセルフレビューを2回以上行い、`REPORT.md`（このディレクトリ）に完了報告を書く（INSTRUCTIONS §11）。
5. `docs/DEPLOY_QUICKSHARE.md`（本番反映手順・ロールバック・スモークテスト）を必ず作る。
6. API契約を変えたら `API_CONTRACT.md` の変更履歴に追記する。クライアント側リポジトリ（`clipshare-qick`）に同じ変更を伝えるため、REPORT.md の「契約の変更点」に列挙する。
