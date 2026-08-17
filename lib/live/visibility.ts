import { prisma } from "@/lib/db/prisma";
import type { LiveVisibility, UserRole } from "@prisma/client";

export type LiveAccessResult = "allowed" | "login_required" | "not_following" | "not_allowed";

const moderationRoles: UserRole[] = ["MODERATOR", "ADMIN", "OWNER"];

export async function canViewLiveStream(
  stream: { userId: string; visibility: LiveVisibility },
  viewerId: string | undefined,
  viewerRole?: string,
): Promise<LiveAccessResult> {
  if (viewerId === stream.userId) {
    return "allowed";
  }

  if (viewerRole && moderationRoles.includes(viewerRole as UserRole)) {
    return "allowed";
  }

  if (stream.visibility === "PUBLIC") {
    return "allowed";
  }

  if (stream.visibility === "PRIVATE") {
    return "not_allowed";
  }

  if (!viewerId) {
    return "login_required";
  }

  const isFollowing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: viewerId,
        followingId: stream.userId,
      },
    },
    select: {
      followerId: true,
    },
  });

  return isFollowing ? "allowed" : "not_following";
}
