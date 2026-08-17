import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { signChatToken } from "@/lib/live/chat-token";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const token = signChatToken({
    sub: session.user.id,
    name: session.user.displayName ?? session.user.username ?? session.user.name ?? "ユーザー",
    role: session.user.role,
  });

  return NextResponse.json({ token });
}
