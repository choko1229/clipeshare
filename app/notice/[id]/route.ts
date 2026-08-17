import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";

type NoticeRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: NoticeRouteProps) {
  const user = await requireActiveUser();
  const { id } = await params;

  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!notification) {
    redirect("/notice");
  }

  await prisma.notification.update({
    where: {
      id: notification.id,
    },
    data: {
      readAt: notification.readAt ?? new Date(),
    },
  });

  if (notification.targetType === "COMMENT") {
    const comment = await prisma.comment.findUnique({
      where: {
        id: notification.targetId,
      },
      include: {
        post: {
          select: {
            publicId: true,
          },
        },
      },
    });

    if (comment?.post.publicId) {
      redirect(`/c/${comment.post.publicId}#comment-${comment.id}`);
    }
  }

  if (notification.targetType === "POST") {
    const post = await prisma.post.findUnique({
      where: {
        id: notification.targetId,
      },
      select: {
        publicId: true,
      },
    });

    if (post?.publicId) {
      redirect(`/c/${post.publicId}`);
    }
  }

  if (notification.targetType === "LIVE_STREAM") {
    const liveStream = await prisma.liveStream.findUnique({
      where: {
        id: notification.targetId,
      },
      select: {
        viewToken: true,
      },
    });

    if (liveStream?.viewToken) {
      redirect(`/l/${liveStream.viewToken}`);
    }
  }

  if (notification.targetType === "USER") {
    const targetUser = await prisma.user.findUnique({
      where: {
        id: notification.targetId,
      },
      select: {
        username: true,
      },
    });

    if (targetUser?.username) {
      redirect(`/users/${targetUser.username}`);
    }
  }

  redirect("/notice");
}
