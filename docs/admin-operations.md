# 管理画面 運用メモ

## 最初の管理者設定

ログイン済みユーザーをメールアドレスで `OWNER` に変更します。

```bash
cd /var/www/clipeshare/current
set -a
source /var/www/clipeshare/shared/.env.production
set +a
npm run admin:promote -- user@example.com OWNER
```

指定できるロール:

- `MODERATOR`
- `ADMIN`
- `OWNER`

## 管理画面URL

```txt
https://clipshare.link/admin
```

## MVPでできること

- 通報一覧
- 通報ステータス更新
- 投稿非公開化
- 投稿公開戻し
- NSFW指定 / 解除
- コメント削除
- ユーザーBAN
- 管理者操作ログ確認

## 注意

`ADMIN` と `OWNER` はユーザーBANができます。`MODERATOR` は通報、投稿、コメント対応までです。
