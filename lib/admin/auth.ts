import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

const adminRoles = new Set(["MODERATOR", "ADMIN", "OWNER"]);
const ownerRoles = new Set(["ADMIN", "OWNER"]);

export async function requireModerator() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.role || !adminRoles.has(session.user.role)) {
    redirect("/");
  }

  return {
    id: session.user.id,
    role: session.user.role,
  };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.role || !ownerRoles.has(session.user.role)) {
    redirect("/");
  }

  return {
    id: session.user.id,
    role: session.user.role,
  };
}
