import { useEffect, useState } from "react";

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface MediaFlags {
  saveData: boolean;
  isSlowConnection: boolean;
  prefersReducedMotion: boolean;
  isTouch: boolean;
}

function readConnection(): NetworkInformation | undefined {
  return (navigator as unknown as { connection?: NetworkInformation }).connection;
}

export function useMediaFlags(): MediaFlags {
  const [flags, setFlags] = useState<MediaFlags>(() => {
    if (typeof window === "undefined") {
      return { saveData: false, isSlowConnection: false, prefersReducedMotion: false, isTouch: false };
    }
    const connection = readConnection();
    return {
      saveData: !!connection?.saveData,
      isSlowConnection:
        connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g",
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      isTouch: window.matchMedia("(pointer: coarse)").matches,
    };
  });

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setFlags((prev) => ({ ...prev, prefersReducedMotion: motionQuery.matches }));
    motionQuery.addEventListener("change", update);
    return () => motionQuery.removeEventListener("change", update);
  }, []);

  return flags;
}
