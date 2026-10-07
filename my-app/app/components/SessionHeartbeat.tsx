"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createSessionHeartbeatLifecycle,
} from "@/lib/session-heartbeat";

const HEARTBEAT_INTERVAL_MS = 10_000;
const CHANNEL_NAME = "marcon-session-lifecycle";

export default function SessionHeartbeat() {
  const router = useRouter();

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    const lifecycle = createSessionHeartbeatLifecycle({
      isVisible: () => document.visibilityState === "visible",
      heartbeat: async () => fetch("/api/auth/heartbeat", {
        method: "POST",
        cache: "no-store",
      }),
      leave: () => {
        navigator.sendBeacon(
          "/api/auth/leave",
          new Blob([], { type: "text/plain" }),
        );
      },
      broadcastLeave: () => channel?.postMessage({ type: "leave" }),
      redirectToLogin: () => {
        router.replace("/login?aviso=inatividade");
        router.refresh();
      },
    });
    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<unknown>) => {
          if (
            event.data &&
            typeof event.data === "object" &&
            "type" in event.data &&
            event.data.type === "leave"
          ) {
            lifecycle.onPeerLeave();
          }
        };
      }
    } catch (error) {
      console.error("[auth] Não foi possível abrir o canal entre abas.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }

    const onVisibilityChange = () => lifecycle.onVisibilityChange();
    const onPageShow = (event: PageTransitionEvent) => lifecycle.onPageShow(event.persisted);
    const onPageHide = () => lifecycle.onPageHide();
    const interval = window.setInterval(lifecycle.onInterval, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    lifecycle.onInterval();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      channel?.close();
    };
  }, [router]);

  return null;
}
