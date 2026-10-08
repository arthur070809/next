import { describe, expect, it, vi } from "vitest";
import { createSessionHeartbeatLifecycle } from "./session-heartbeat";

function actions() {
  return {
    visible: true,
    isVisible() { return this.visible; },
    heartbeat: vi.fn(async () => ({ status: 204 })),
    leave: vi.fn(),
    broadcastLeave: vi.fn(),
    redirectToLogin: vi.fn(),
  };
}

describe("shared session heartbeat lifecycle", () => {
  it("sends periodic heartbeats only while visible", async () => {
    const state = actions();
    const lifecycle = createSessionHeartbeatLifecycle(state);
    lifecycle.onInterval();
    await vi.waitFor(() => expect(state.heartbeat).toHaveBeenCalledTimes(1));
    state.visible = false;
    lifecycle.onInterval();//
    await Promise.resolve();
    expect(state.heartbeat).toHaveBeenCalledTimes(1);
  });

  it("sends immediately on return to visibility and BFCache restoration", async () => {
    const state = actions();
    const lifecycle = createSessionHeartbeatLifecycle(state);
    lifecycle.onVisibilityChange();
    lifecycle.onPageShow(true);
    await vi.waitFor(() => expect(state.heartbeat).toHaveBeenCalledTimes(2));
  });

  it("marks leave on pagehide and triggers an immediate heartbeat in peer tabs", async () => {
    const state = actions();
    const lifecycle = createSessionHeartbeatLifecycle(state);
    lifecycle.onPageHide();
    expect(state.leave).toHaveBeenCalledOnce();
    expect(state.broadcastLeave).toHaveBeenCalledOnce();
    lifecycle.onPeerLeave();
    await vi.waitFor(() => expect(state.heartbeat).toHaveBeenCalledOnce());
  });

  it("redirects to the inactivity notice after a 401", async () => {
    const state = actions();
    state.heartbeat.mockResolvedValue({ status: 401 });
    const lifecycle = createSessionHeartbeatLifecycle(state);
    lifecycle.onInterval();
    lifecycle.onPeerLeave();
    await vi.waitFor(() => expect(state.redirectToLogin).toHaveBeenCalledOnce());
  });
});
