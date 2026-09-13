import type { Metadata } from "next";
import { ViewportDiagnostics } from "@/components/pwa/viewport-diagnostics";

export const metadata: Metadata = {
  title: "表示診断",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ViewportDebugPage() {
  return (
    <main className="px-4 py-6">
      <h1 className="text-2xl font-bold">表示診断</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        この画面のスクリーンショットを送ってください。PWAの表示幅やセーフエリアが正しく認識されているかを確認します。
      </p>
      <ViewportDiagnostics />
    </main>
  );
}
