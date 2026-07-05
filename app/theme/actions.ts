"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const themeSchema = z.enum(["system", "dark", "light"]);

export type ThemeValue = z.infer<typeof themeSchema>;

export async function updateThemePreference(theme: ThemeValue) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return;
  }

  const parsed = themeSchema.parse(theme);

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      themePreference: parsed.toUpperCase() as "SYSTEM" | "DARK" | "LIGHT",
    },
  });

  revalidatePath("/", "layout");
}
