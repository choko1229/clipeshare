import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function OfflinePage() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-12">
      <section className="w-full max-w-md rounded-md border border-border bg-card p-6 text-center">
        <h1 className="text-2xl font-bold">オフラインです</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          ネットワークへ接続できません。接続が戻ったらページを再読み込みしてください。
        </p>
        <Button asChild className="mt-5">
          <Link href="/">トップへ戻る</Link>
        </Button>
      </section>
    </main>
  );
}
