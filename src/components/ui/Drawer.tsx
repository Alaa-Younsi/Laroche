import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Physical screen side to dock against — NOT a logical start/end value.
   * RTL callers must compute this themselves (e.g. dir === "rtl" ? "left" : "right"):
   * the slide transform below is a physical translateX and would fly the
   * panel across the screen if paired with a logical CSS position. */
  side?: "left" | "right";
  title?: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, side = "right", title, children }: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className={cn(
              "fixed top-0 z-50 h-full w-full max-w-md bg-panel border-line flex flex-col",
              side === "right" ? "right-0 border-l" : "left-0 border-r",
            )}
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-line px-6 py-5">
                <h3 className="font-display text-xl">{title}</h3>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-muted transition-colors hover:bg-panel-2 hover:text-ink"
                  aria-label="close"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
