import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BentoPanel({
  children,
  className,
  glow = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-panel/80 backdrop-blur-sm",
        glow && "fx-card-glow",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
