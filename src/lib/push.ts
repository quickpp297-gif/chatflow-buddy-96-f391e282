import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BKt76w8Wo4KN4AUHQtJkL2MCf2hIygIu6gPq-glR-QNn_m0e_RdJP_kh3J3avIxDFBWToFWudwHJDwBbhdZupYQ";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

async function registerServiceWorker() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) {
    await existing.update().catch(() => {});
    return existing;
  }

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

async function saveSubscription(accountId: string, userId: string, sub: PushSubscription) {
  const json: any = sub.toJSON();
  const payload = {
    account_id: accountId,
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh || bufToB64(sub.getKey("p256dh")),
    auth: json.keys?.auth || bufToB64(sub.getKey("auth")),
    user_agent: navigator.userAgent,
  };

  const { error } = await supabase.functions.invoke("whatsapp-send", {
    body: { action: "register_push", account_id: accountId, subscription: payload },
  });

  if (error) throw error;
}

export async function ensurePushSubscription(accountId: string, userId: string) {
  if (!pushSupported()) return null;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // If existing subscription was created with a different VAPID key, unsubscribe and resubscribe
    const existingKey = sub.options?.applicationServerKey;
    const expected = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    let same = false;
    if (existingKey) {
      const a = new Uint8Array(existingKey as ArrayBuffer);
      same = a.length === expected.length && a.every((v, i) => v === expected[i]);
    }
    if (!same) {
      try { await sub.unsubscribe(); } catch (_) {}
      try { await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); } catch (_) {}
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await saveSubscription(accountId, userId, sub);

  return sub;
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}