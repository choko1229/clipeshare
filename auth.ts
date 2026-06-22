import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { generateUniqueUsername } from "@/lib/users/username";

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
