export type HeartbeatResponse = { status: number };

export type SessionHeartbeatActions = {
  isVisible: () => boolean;
  heartbeat: () => Promise<HeartbeatResponse>;
  leave: () => void;
  broadcastLeave: () => void;
  redirectToLogin: () => void;
};

export function createSessionHeartbeatLifecycle(actions: SessionHeartbeatActions) {
  let redirected = false;
  let failureReported = false;

  const sendHeartbeat = async (force = false) => {
    if (!force && !actions.isVisible()) return;
    try {
      const response = await actions.heartbeat();
      if (response.status === 401) {
        if (!redirected) {
          redirected = true;
          actions.redirectToLogin();
        }
        return;
      }
      if (response.status >= 200 && response.status < 300) {
        failureReported = false;
      } else if (!failureReported) {
        failureReported = true;
        console.error("[auth] Heartbeat de sessão rejeitado.", { status: response.status });
      }
    } catch (error) {
      if (!failureReported) {
        failureReported = true;
        console.error("[auth] Heartbeat de sessão indisponível.", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
  };

  return {
    onInterval: () => { void sendHeartbeat(); },
    onVisibilityChange: () => {
      if (actions.isVisible()) void sendHeartbeat(true);
    },
    onPageShow: (persisted: boolean) => {
      if (persisted) void sendHeartbeat(true);
    },
    onPageHide: () => {
      actions.leave();
      actions.broadcastLeave();
    },
    onPeerLeave: () => { void sendHeartbeat(true); },
  };
}
