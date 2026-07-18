import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Wordmark({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <Link
      to="/"
      className={cn(
        "flex flex-col items-center leading-none select-none",
        className,
      )}
    >
      <span
        className={cn(
          "font-display text-2xl tracking-wide3 uppercase transition-colors duration-300 hover:text-brand",
          dark ? "text-white" : "text-ink",
        )}
      >
        Laroche
      </span>
      <span
        className={cn(
          "mt-1 text-[0.55rem] tracking-wide3 uppercase",
          dark ? "text-brand" : "text-brand",
        )}
      >
        Bijoux
      </span>
    </Link>
  );
}
