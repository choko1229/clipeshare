# ゲーム情報メタデータ

ゲーム別ページは `/games/{slug}` で公開します。

## 登録元

- 投稿時に入力されたゲーム名から `Game` が自動作成されます。
- 管理画面 `/admin/games` で概要、画像URL、ジャンル、プラットフォーム、外部IDを編集できます。
- `IGDB_CLIENT_ID` と `IGDB_CLIENT_SECRET` を設定すると、管理画面から1件ずつIGDB同期できます。
- SteamはAPIキーなしで、Steam App IDまたはゲーム名候補検索から同期できます。
- `RAWG_API_KEY` を設定すると、RAWG slugまたはゲーム名検索から同期できます。

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

## Steam同期の動き

- `Steam App ID` が入力済みの場合は、そのIDを指定して同期します。
- `Steam App ID` が未入力の場合は、管理画面でSteam候補検索を行い、候補から選んで同期できます。
- Steam同期はAPIキー不要です。
- 手動入力済みの概要、画像、公式URL、ジャンル、プラットフォーム、発売日は維持し、空欄を優先して補完します。

## Steam同期で保存する項目

- `steamAppId`
- `steamHeaderUrl`
- `steamCapsuleUrl`
- `summary`
- `coverUrl`
- `heroUrl`
- `officialUrl`
- `genres`
- `platforms`
- `releaseDate`
- `lastSteamSyncedAt`
- `lastSyncedAt`

## RAWG同期の動き

- `RAWG_API_KEY` が必要です。
- `RAWG slug` が入力済みの場合はslug指定で同期します。
- `RAWG slug` が未入力の場合は、現在のゲーム名でRAWG検索し、最初の候補を同期します。
- 手動入力済みの概要、画像、公式URL、ジャンル、プラットフォーム、発売日は維持し、空欄を優先して補完します。

## RAWG同期で保存する項目

- `rawgId`
- `rawgSlug`
- `rawgBackgroundUrl`
- `metacriticScore`
- `summary`
- `coverUrl`
- `heroUrl`
- `officialUrl`
- `genres`
- `platforms`
- `releaseDate`
- `lastRawgSyncedAt`
- `lastSyncedAt`

## ゲームまとめページ

ゲーム別ページ `/games/{slug}` は、YouTubeのゲームトピック風に以下を表示します。

- ヒーロー画像
- ゲーム概要
- ジャンル、プラットフォーム、発売日
- 投稿数
- 人気投稿
- 最近の投稿
- よく使われるタグ
- 投稿しているユーザー
- Steam/公式サイトリンク

## 注意点

- API同期はサーバー側だけで実行します。ブラウザからIGDBへ直接アクセスしません。
- RAWG同期には `RAWG_API_KEY` が必要です。未設定時は管理画面のRAWG同期ボタンが無効になります。
- 外部API由来のデータ利用条件はサービスごとに確認が必要です。
