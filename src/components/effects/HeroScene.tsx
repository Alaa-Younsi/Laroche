import { lazy, Suspense } from "react";
import { useMediaFlags } from "@/hooks/useMediaFlags";
import { ErrorBoundary } from "@/components/effects/ErrorBoundary";
import { HeroFallback2D } from "@/components/effects/HeroFallback2D";

const HeroGem3D = lazy(() =>
  import("@/components/effects/HeroGem3D").then((m) => ({ default: m.HeroGem3D })),
);

export function HeroScene() {
  const { saveData, isSlowConnection, prefersReducedMotion, isTouch } = useMediaFlags();
  const use2D = saveData || isSlowConnection || prefersReducedMotion || isTouch;

  if (use2D) return <HeroFallback2D />;

  return (
    <ErrorBoundary fallback={<HeroFallback2D />}>
      <Suspense fallback={<HeroFallback2D />}>
        <HeroGem3D />
      </Suspense>
    </ErrorBoundary>
  );
}
