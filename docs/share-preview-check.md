# 共有プレビュー確認手順

Discord / X の共有表示は外部サービス側のキャッシュや判定に左右されます。
Clipeshare側では、投稿詳細ページのメタタグと共有用MP4の配信状態を先に確認します。

## 確認コマンド

```bash
node scripts/check-share-metadata.mjs https://clipshare.link/c/{ID}
```

確認できる項目:

- `og:title`
- `og:description`
- `og:image`
- `twitter:*`
- 動画投稿の場合の `og:video`
- 共有用MP4の `Range` リクエスト対応

## 判定

`Required metadata` がすべて `OK` なら、通常のカード表示に必要な基本情報は出ています。

公開・非NSFW・変換完了済みの動画投稿では、`Video metadata` に `og:video` と `twitter:player:stream` が出ます。
画像投稿、NSFW投稿、非公開投稿、変換中の投稿では動画メタタグが出ないのが正常です。

動画投稿で `Checking video range support` が `Status: 206` になれば、MP4の部分取得に対応できています。

## Discordキャッシュ対策

DiscordはURLごとにプレビュー情報をキャッシュします。
修正直後に表示が変わらない場合は、新規投稿で確認するか、以下のようにクエリを付けて確認します。

```text
https://clipshare.link/c/{ID}?v=1
```

## X共有について

APIを使わない場合、Xの投稿画面に動画ファイルを自動添付することはできません。
Clipeshareでは投稿詳細の共有パネルから以下を使います。

- `X投稿文コピー`
- `X用MP4ダウンロード`

ユーザーがX投稿画面でMP4を手動添付し、コピーした本文を貼り付ける運用です。
