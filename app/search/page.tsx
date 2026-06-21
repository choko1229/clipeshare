export default function SearchPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">検索</h1>
      <form className="mt-5">
        <input
          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none ring-ring transition focus:ring-2"
          placeholder="キーワード game:Valorant tag:ace from:username type:clip"
          type="search"
        />
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        検索パーサーとDB検索は検索機能フェーズで接続します。
      </p>
    </main>
  );
}
