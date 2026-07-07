"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { endpointHash } from "@/lib/notifications/web-push";

const subscriptionSchema = z.object({
  auth: z.string().min(1),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  userAgent: z.string().max(1000).optional(),
});

export async function savePushSubscription(input: unknown) {
  const user = await requireActiveUser();
  const parsed = subscriptionSchema.parse(input);

  await prisma.pushSubscription.upsert({
    where: {
      endpointHash: endpointHash(parsed.endpoint),
    },
    update: {
      auth: parsed.auth,
      p256dh: parsed.p256dh,
      revokedAt: null,
      userAgent: parsed.userAgent ?? null,
      userId: user.id,
    },
    create: {
      auth: parsed.auth,
      endpoint: parsed.endpoint,
      endpointHash: endpointHash(parsed.endpoint),
      p256dh: parsed.p256dh,
      userAgent: parsed.userAgent ?? null,
      userId: user.id,
    },
  });

  revalidatePath("/settings/notifications");
}

export async function revokePushSubscription(endpoint: string) {
  const user = await requireActiveUser();
  const parsedEndpoint = z.string().url().parse(endpoint);

  await prisma.pushSubscription.updateMany({
    where: {
      endpointHash: endpointHash(parsedEndpoint),
      userId: user.id,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  revalidatePath("/settings/notifications");
}
