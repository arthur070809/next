type VisibilityTarget = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

export function startVisibilityPolling(
  target: VisibilityTarget,
  callback: () => void,
  intervalMs: number,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const stopTimer = () => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  const poll = () => {
    if (target.visibilityState === "visible") callback();
  };
  const startTimer = () => {
    if (timer === undefined && target.visibilityState === "visible") {
      timer = setInterval(poll, intervalMs);
    }
  };
  const handleVisibilityChange = () => {
    if (target.visibilityState === "hidden") {
      stopTimer();
    } else {
      poll();
      startTimer();
    }
  };

  target.addEventListener("visibilitychange", handleVisibilityChange);
  startTimer();
  return () => {
    stopTimer();
    target.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
