import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { HeaderProfile } from "@/components/layout/header-profile";
import { HeaderSearch } from "@/components/layout/header-search";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GlobalPostDrop } from "@/components/uploads/global-post-drop";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Clipshare",
    template: "%s | Clipshare",
  },
  description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
  applicationName: "Clipshare",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Clipshare",
    title: "Clipshare",
    description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clipshare",
    description: "ゲームクリップとスクリーンショットを共有するメディアサイト",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080d",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function normalizeTheme(value: string | null | undefined) {
  if (value === "DARK") {
    return "dark" as const;
  }

  if (value === "LIGHT") {
    return "light" as const;
  }

  return "system" as const;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: {
          id: session.user.id,
        },
        select: {
          avatarUrl: true,
          displayName: true,
          image: true,
          name: true,
          themePreference: true,
          username: true,
        },
      })
    : null;
  const initialTheme = normalizeTheme(user?.themePreference);

  return (
    <html data-theme={initialTheme} lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider initialTheme={initialTheme} persistToDatabase={Boolean(session?.user?.id)}>
          <ServiceWorkerRegister />
          <GlobalPostDrop />
          <div className="min-h-dvh bg-background text-foreground">
            <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
              <div className="flex h-16 w-full items-center justify-between gap-4 px-4">
                <Link className="flex shrink-0 items-center gap-3" href="/">
                  <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">
                    C
                  </span>
                  <span className="text-lg font-extrabold tracking-normal">Clipshare</span>
                </Link>

                <nav className="flex min-w-0 items-center justify-end gap-2">
                  <HeaderSearch />
                  <ThemeToggle />
                  {session?.user ? (
                    <>
                      {session.user.role && ["MODERATOR", "ADMIN", "OWNER"].includes(session.user.role) ? (
                        <Button asChild className="hidden sm:inline-flex" variant="ghost">
                          <Link href="/admin">管理</Link>
                        </Button>
                      ) : null}
                      <HeaderProfile
                        image={user?.avatarUrl ?? user?.image ?? session.user.image}
                        name={user?.displayName ?? user?.name ?? session.user.displayName ?? session.user.name}
                        username={user?.username ?? session.user.username}
                      />
                      <Button asChild className="hidden md:inline-flex">
                        <Link href="/posts/new">投稿</Link>
                      </Button>
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
            <footer className="border-t border-border/70 px-4 py-6">
              <div className="flex w-full flex-wrap gap-4 text-sm text-muted-foreground">
                <Link className="hover:text-foreground" href="/terms">
                  利用規約
                </Link>
                <Link className="hover:text-foreground" href="/privacy">
                  プライバシーポリシー
                </Link>
                <Link className="hover:text-foreground" href="/guidelines">
                  ガイドライン
                </Link>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
