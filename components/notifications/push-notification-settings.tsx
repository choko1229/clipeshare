"use client";

import { useMemo, useState, useTransition } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { revokePushSubscription, savePushSubscription } from "@/app/settings/notifications/actions";
import { Button } from "@/components/ui/button";

type PushNotificationSettingsProps = {
  publicKey?: string;
};

export function PushNotificationSettings({ publicKey }: PushNotificationSettingsProps) {
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [isPending, startTransition] = useTransition();
  const supported = useMemo(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    [],
  );

  async function enable() {
    setMessage("");
    if (!supported) {
      setMessage("このブラウザはWeb Push通知に対応していません。");
      return;
    }

    if (!publicKey) {
      setMessage("サーバーにWEB_PUSH_VAPID_PUBLIC_KEYが設定されていません。");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      setMessage("通知が許可されませんでした。ブラウザ設定を確認してください。");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(publicKey),
        userVisibleOnly: true,
      }));
    const json = subscription.toJSON();

    startTransition(async () => {
      await savePushSubscription({
        auth: json.keys?.auth,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        userAgent: navigator.userAgent,
      });
      setMessage("この端末で通知を受け取れるようにしました。");
    });
  }

  async function disable() {
    setMessage("");
    if (!supported) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      setMessage("この端末では通知が有効になっていません。");
      return;
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    startTransition(async () => {
      await revokePushSubscription(endpoint);
      setMessage("この端末の通知を解除しました。");
    });
  }

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">端末通知</h2>
        <p className="mt-1 text-sm text-muted-foreground">コメント、返信、いいね、フォローをブラウザ通知で受け取れます。</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={isPending || !supported} onClick={enable} type="button">
          {isPending ? <LoaderCircle className="animate-spin" size={18} /> : <Bell size={18} />}
          この端末で有効化
        </Button>
        <Button disabled={isPending || !supported} onClick={disable} type="button" variant="outline">
          <BellOff size={18} />
          この端末を解除
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        現在の許可状態: {permission === "granted" ? "許可" : permission === "denied" ? "拒否" : permission === "default" ? "未選択" : "未対応"}
      </p>
      {message ? <p className="mt-3 rounded-md border border-border bg-background p-3 text-sm">{message}</p> : null}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
