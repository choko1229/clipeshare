import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export type ActiveUser = {
  id: string;
  username: string | null;
};

export async function requireActiveUser(): Promise<ActiveUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      username: true,
      isBanned: true,
      banReason: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.isBanned) {
    const suffix = user.banReason ? ` 理由: ${user.banReason}` : "";
    throw new Error(`このアカウントはBANされているため操作できません。${suffix}`);
  }

  return {
    id: user.id,
    username: user.username,
  };
}
