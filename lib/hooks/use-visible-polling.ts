import { useEffect, useRef } from "react";

// useVisiblePolling — calls `onTick` on a fixed interval while the tab is
// visible, pausing when the tab is hidden and firing once immediately on return
// so the view catches up. This is the project's lightweight realtime mechanism:
// room messages and participants stay current without a websocket/server-push
// layer, and a backgrounded tab stops polling so it does no needless work.
//
// `onTick` is held in a ref so the interval keeps a stable cadence even when the
// caller passes a fresh callback on each render (the classic useInterval
// pattern); only a change to `intervalMs` restarts the timer.
export function useVisiblePolling(onTick: () => void, intervalMs: number) {
  const savedTick = useRef(onTick);

  useEffect(() => {
    savedTick.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => savedTick.current();

    const start = () => {
      if (timer === null) timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
