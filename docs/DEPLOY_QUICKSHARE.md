# Clipshare Quick 本番反映手順（feature/quickshare-api-v1）

> この手順は**人が実施する**。Claude Code は本番DB・本番サーバーへの操作、`main` へのマージを行っていない。

## OGP の表示確認（Discord / X）
公開URLでしか確認できないため、本番（またはインターネットから見えるステージング）で人が行う。

1. 画像を1枚アップロードする（`/qick`、または `POST /api/v1/quick`）。返ってきた `https://clipshare.link/q/{id}` を控える。
2. HTML のメタタグを確認する（クローラーと同じく `Accept: text/html` で取得すると `/q/{id}/view` にリダイレクトされる）:
   ```sh
   curl -sL -H 'Accept: text/html' -A 'Discordbot/2.0' https://clipshare.link/q/{id} | grep -E 'og:|twitter:|robots'
   ```
   期待値: `og:title`=`クイック共有 · 画像`、`og:description`=`24時間後に自動で削除されます。`、`og:site_name`=`Clipshare`、`og:image`=`https://clipshare.link/media/quick/images/{id}.webp`、`twitter:card`=`summary_large_image`、`robots`=`noindex, nofollow`。
3. `og:image` の URL を `curl -I` して `200` と `Content-Type: image/webp` を確認する（nginx が `/media/` を配信している場合はその設定でも可）。
4. Discord の任意のチャンネル（テスト用サーバー）に `https://clipshare.link/q/{id}` を貼り、画像付きのカードが出ることを確認する。
5. X の投稿作成画面に同じURLを貼り、カード（大きい画像）が出ることを確認する（X は投稿前のプレビューで確認可能）。
6. 動画でも同じ確認をする。変換完了（`READY`）後は `og:image`=サムネイル、`og:video`=mp4。処理中（`PROCESSING`）はメディアのタグを出さない。
   - Discord は `og:video` で動画プレーヤー、X は `summary_large_image`（サムネイル）になる想定。表示されない場合は結果を `docs/quickshare/QUESTIONS.md` に記録する。
7. 期限切れ（または削除済み）の URL ではメディアのタグが出ないことを確認する。
