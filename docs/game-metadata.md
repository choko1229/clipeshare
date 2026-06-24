# ゲーム情報メタデータ

ゲーム別ページは `/games/{slug}` で公開します。

## 登録元

- 投稿時に入力されたゲーム名から `Game` が自動作成されます。
- 管理画面 `/admin/games` で概要、画像URL、ジャンル、プラットフォーム、外部IDを編集できます。
- `IGDB_CLIENT_ID` と `IGDB_CLIENT_SECRET` を設定すると、管理画面から1件ずつIGDB同期できます。

## IGDB同期の動き

- `IGDB ID` が入力済みの場合は、そのIDを指定して同期します。
- `IGDB ID` が未入力の場合は、現在のゲーム名でIGDB検索し、最初に一致したゲームを同期します。
- 同名ゲームやシリーズ作品がある場合は、先にIGDB IDを手入力して保存してから同期してください。

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
