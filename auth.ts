import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import EmailProvider from "next-auth/providers/email";
import TwitterProvider from "next-auth/providers/twitter";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { generateUniqueUsername } from "@/lib/users/username";

/** Discord の認可サーバーの issuer(認可レスポンスの iss と完全一致で照合される) */
export const DISCORD_ISSUER = "https://discord.com";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret:
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "development-secret" : undefined),
  session: {
    strategy: "database",
  },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      // Discord は認可レスポンスに iss(RFC 9207)を付ける。openid-client は issuer が未設定だと
      // 「issuer must be configured on the issuer」で拒否するため、メタデータの issuer を指定する
      // (https://discord.com/.well-known/oauth-authorization-server の issuer)
      issuer: DISCORD_ISSUER,
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID ?? "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET ?? "",
      version: "2.0",
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      let username = user.username;
      let displayName = user.displayName ?? user.name ?? null;

      if (!username) {
        username = await generateUniqueUsername(user.name ?? user.email ?? user.id);
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            username,
            displayName,
            avatarUrl: user.image,
          },
          select: {
            username: true,
            displayName: true,
          },
        });
        username = updatedUser.username;
        displayName = updatedUser.displayName;
      }

      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        session.user.username = username;
        session.user.displayName = displayName;
      }
      return session;
    },
  },
};
