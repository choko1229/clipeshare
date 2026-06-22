# ゲーム情報メタデータ

ゲーム別まとめページは `/games/{slug}` で公開します。

## 登録元

- 投稿時に入力されたゲーム名から `Game` が自動作成されます。
- 管理画面 `/admin/games` で概要、画像URL、ジャンル、プラットフォーム、外部IDを編集できます。
- `IGDB_CLIENT_ID` と `IGDB_CLIENT_SECRET` を設定すると、管理画面から1件ずつIGDB同期できます。

## IGDB同期で保存する項目

- `igdbId`
- `name`
- `summary`
- `coverUrl`
- `heroUrl`
- `officialUrl`
- `genres`
- `platforms`
- `releaseDate`
- `lastSyncedAt`

## 注意点

- API同期はサーバー側だけで実行します。ブラウザからIGDBへ直接アクセスしません。
- Steam App ID と RAWG slug は保存欄だけ用意しています。自動同期は未実装です。
- 外部API由来のデータ利用条件はサービスごとに確認が必要です。
