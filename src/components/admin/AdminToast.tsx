import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Every admin write goes through PostgREST, and every one of them can be
// refused — an RLS policy the worker isn't granted, a lost connection, a column
// the payload shouldn't have carried. Before this existed those errors were
// dropped on the floor: the form navigated away, the row re-rendered from a
// stale cache, and the change looked saved when nothing had been written.
// One shared surface so no write can fail quietly again.

type Tone = "ok" | "error";

interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
}

interface AdminToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

// Failures stay up long enough to read and act on; confirmations get out of
// the way.
const DURATION: Record<Tone, number> = { ok: 3500, error: 7000 };

const AdminToastContext = createContext<AdminToastApi | null>(null);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, text: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, tone, text }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION[tone]),
      );
    },
    [dismiss],
  );

  // A toast fired by a page that then unmounts (ProductForm navigates on save)
  // outlives its trigger — the pending timers belong to the provider, so clear
  // them here rather than leaking one per toast.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo<AdminToastApi>(
    () => ({
      success: (text: string) => push("ok", text),
      error: (text: string) => push("error", text),
    }),
    [push],
  );

  return (
    <AdminToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            aria-live={item.tone === "error" ? "assertive" : "polite"}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg",
              item.tone === "ok"
                ? "border-brand/40 bg-panel text-ink"
                : "border-red-500/40 bg-panel text-ink",
            )}
          >
            {item.tone === "ok" ? (
              <Check size={16} className="mt-0.5 shrink-0 text-brand" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
            )}
            <span className="flex-1">{item.text}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="mt-0.5 shrink-0 text-muted hover:text-ink"
              aria-label="close"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}

export function useAdminToast(): AdminToastApi {
  const api = useContext(AdminToastContext);
  if (!api) throw new Error("useAdminToast must be used inside <AdminToastProvider>");
  return api;
}
