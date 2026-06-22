import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Clipeshare",
    template: "%s | Clipeshare",
  },
  description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
  applicationName: "Clipeshare",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Clipeshare",
    title: "Clipeshare",
    description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clipeshare",
    description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="min-h-dvh bg-background text-foreground">
          <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link className="flex items-center gap-3" href="/">
                <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">
                  C
                </span>
                <span className="text-lg font-semibold tracking-normal">Clipeshare</span>
              </Link>
              <nav className="flex items-center gap-2">
                <Button asChild variant="ghost">
                  <Link href="/search">検索</Link>
                </Button>
                {session?.user ? (
                  <>
                    {session.user.username ? (
                      <Button asChild variant="ghost">
                        <Link href={`/users/${session.user.username}`}>プロフィール</Link>
                      </Button>
                    ) : null}
                    {session.user.role && ["MODERATOR", "ADMIN", "OWNER"].includes(session.user.role) ? (
                      <Button asChild variant="ghost">
                        <Link href="/admin">管理</Link>
                      </Button>
                    ) : null}
                    <Button asChild>
                      <Link href="/posts/new">投稿</Link>
                    </Button>
                    <LogoutButton />
                  </>
                ) : (
                  <Button asChild>
                    <Link href="/login">ログイン</Link>
                  </Button>
                )}
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
