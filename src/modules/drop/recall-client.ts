"use client";

/**
 * The browser side of Thought of the Day: the signature sound, and turning
 * this device's daily notification on or off (web push through /sw.js).
 */

export const SOUND_URL = "/sounds/recall.wav";

/** Plays the signature sound once, quietly. Browsers only allow it after the page has been used, so a refusal is ignored. */
export function playRecallSound(): void {
  try {
    const a = new Audio(SOUND_URL);
    a.volume = 0.7;
    void a.play().catch(() => {});
  } catch {
    // No audio here: the card still shows.
  }
}

/** Whether this browser can get the daily notification at all. */
export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** "Chrome on Mac": a name for this device in Settings. */
export function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Whether this device is already getting the notification. */
export async function pushIsOn(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return !!(await reg?.pushManager.getSubscription());
}

/**
 * Turns the daily notification on for this device: asks permission (it must
 * follow a click), subscribes, and tells the server. Returns why not, if not.
 */
export async function turnPushOn(): Promise<"on" | "denied" | "unsupported" | "not_configured" | "failed"> {
  if (!pushSupported()) return "unsupported";
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "not_configured";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const res = await fetch("/api/drop/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), device: deviceName() }) });
    return res.ok ? "on" : "failed";
  } catch {
    return "failed";
  }
}

/** Turns it off for this device. */
export async function turnPushOff(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/drop/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Keeps the worker registered on every visit (so a subscription made elsewhere stays live), without asking anything. */
export function keepWorker(): void {
  if (pushSupported() && Notification.permission === "granted") void registration().catch(() => {});
}
