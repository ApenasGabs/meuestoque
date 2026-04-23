import { useCallback, useEffect, useRef, useState } from "react";

interface WakeLockSentinelLike extends EventTarget {
  released: boolean;
  release: () => Promise<void>;
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

interface UseWakeLockReturn {
  isActive: boolean;
  isSupported: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

export const useWakeLock = (): UseWakeLockReturn => {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [isActive, setIsActive] = useState(false);

  const isSupported =
    typeof navigator !== "undefined" &&
    Boolean((navigator as NavigatorWithWakeLock).wakeLock?.request);

  const release = useCallback(async (): Promise<void> => {
    if (!sentinelRef.current) return;

    try {
      await sentinelRef.current.release();
    } finally {
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  const request = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    if (sentinelRef.current && !sentinelRef.current.released) return;

    const wakeLockApi = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLockApi) return;

    try {
      const sentinel = await wakeLockApi.request("screen");
      sentinelRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
        }
        setIsActive(false);
      });
    } catch {
      setIsActive(false);
    }
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async (): Promise<void> => {
      if (document.visibilityState === "visible" && isActive && !sentinelRef.current) {
        await request();
      }
    };

    const onVisibilityChange = () => {
      void handleVisibilityChange();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void release();
    };
  }, [isActive, isSupported, release, request]);

  return { isActive, isSupported, request, release };
};
