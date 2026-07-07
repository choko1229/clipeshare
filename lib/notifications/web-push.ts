import crypto from "node:crypto";
import webPush from "web-push";
import { prisma } from "@/lib/db/prisma";

type PushPayload = {
  body: string;
  title: string;
  url: string;
};

type PushSubscriptionLike = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

let configured = false;

export function endpointHash(endpoint: string) {
  return crypto.createHash("sha256").update(endpoint).digest("hex");
}

function configureWebPush() {
  if (configured) {
    return true;
  }

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const contact = process.env.WEB_PUSH_CONTACT;

  if (!publicKey || !privateKey || !contact) {
    return false;
  }

  webPush.setVapidDetails(contact, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendWebPushToUser(userId: string, payload: PushPayload) {
  if (!configureWebPush()) {
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId,
      revokedAt: null,
    },
  });

  if (subscriptions.length === 0) {
    return;
  }

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(toWebPushSubscription(subscription), JSON.stringify(payload));
      } catch {
        await prisma.pushSubscription.update({
          where: {
            id: subscription.id,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }
    }),
  );
}

function toWebPushSubscription(subscription: PushSubscriptionLike) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      auth: subscription.auth,
      p256dh: subscription.p256dh,
    },
  };
}
