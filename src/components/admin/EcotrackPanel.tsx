import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  RefreshCw,
  FileDown,
  PlugZap,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import {
  validateToken,
  getWilayas,
  resolveWilayaCode,
  orderToPayload,
  createOrder,
  dispatchOrder,
  getLabel,
  getTrackingInfo,
  isEcotrackError,
  type EcotrackError,
} from "@/lib/ecotrack";
import type { Order } from "@/types/db";

type Busy = null | "check" | "ship" | "dispatch" | "label" | "sync";
type Feedback = { kind: "ok" | "err"; text: string } | null;

function errText(err: unknown): string {
  if (isEcotrackError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Best-effort latest-status extraction from the tracking/info payload, whose
 *  exact shape varies per ECOTRACK deployment. Returns null if unrecognized. */
function latestStatus(info: unknown): string | null {
  const pickFrom = (entry: unknown): string | null => {
    if (entry && typeof entry === "object") {
      const rec = entry as Record<string, unknown>;
      const value = rec.status ?? rec.situation ?? rec.remarque ?? rec.activity;
      if (typeof value === "string" && value.length > 0) return value;
    }
    return null;
  };
  if (Array.isArray(info) && info.length > 0) return pickFrom(info[info.length - 1]);
  if (info && typeof info === "object") {
    const rec = info as Record<string, unknown>;
    const activities = rec.activities ?? rec.OrderHistory ?? rec.history;
    if (Array.isArray(activities) && activities.length > 0) {
      return pickFrom(activities[activities.length - 1]);
    }
    return pickFrom(info);
  }
  return null;
}

export function EcotrackPanel({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const tracking = order.ecotrack_tracking ?? null;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  async function saveOrder(fields: Partial<Order>) {
    const { error } = await supabase.from("orders").update(fields).eq("id", order.id);
    if (error) throw { status: 0, message: error.message, raw: error };
  }

  async function onCheck() {
    setBusy("check");
    setFeedback(null);
    try {
      const result = await validateToken();
      const ok = result.success === true || /valid/i.test(result.message ?? "");
      setFeedback({
        kind: ok ? "ok" : "err",
        text: result.message || (ok ? "Connexion ECOTRACK OK" : "Token refusé"),
      });
    } catch (err) {
      setFeedback({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function onShip() {
    setBusy("ship");
    setFeedback(null);
    try {
      const wilayas = await getWilayas();
      const code = resolveWilayaCode(wilayas, order.wilaya);
      if (code === null) {
        throw { status: 0, message: `Code wilaya introuvable pour « ${order.wilaya} »`, raw: null };
      }
      const result = await createOrder(orderToPayload(order, code));
      const trackingNo = result.tracking;
      if (!trackingNo) {
        throw {
          status: 0,
          message: result.message || "ECOTRACK n'a pas renvoyé de numéro de suivi",
          raw: result,
        };
      }
      // The parcel now exists at ECOTRACK. If persisting the tracking number
      // fails we must NOT let the operator retry blind — a second click would
      // create a duplicate parcel. Surface the number so it can be pasted back.
      try {
        await saveOrder({
          ecotrack_tracking: trackingNo,
          ecotrack_status: "created",
          ecotrack_synced_at: new Date().toISOString(),
          status: "shipped",
        });
      } catch (saveErr) {
        throw {
          status: 0,
          message:
            `Colis créé chez ECOTRACK (suivi ${trackingNo}) mais l'enregistrement ` +
            `a échoué : ${errText(saveErr)}. Ne pas réexpédier — notez ce numéro.`,
          raw: saveErr,
        } satisfies EcotrackError;
      }
      setFeedback({ kind: "ok", text: `Expédié — suivi ${trackingNo}` });
      refresh();
    } catch (err) {
      setFeedback({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function onDispatch() {
    if (!tracking) return;
    setBusy("dispatch");
    setFeedback(null);
    try {
      const result = await dispatchOrder(tracking);
      const ok = result.success === true;
      if (ok) {
        await saveOrder({
          ecotrack_status: "dispatched",
          ecotrack_synced_at: new Date().toISOString(),
        });
        refresh();
      }
      setFeedback({
        kind: ok ? "ok" : "err",
        text: result.message || (ok ? "Remis au transporteur" : "Échec de la remise"),
      });
    } catch (err) {
      setFeedback({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function onLabel() {
    if (!tracking) return;
    setBusy("label");
    setFeedback(null);
    try {
      const blob = await getLabel(tracking);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setFeedback({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function onSync() {
    if (!tracking) return;
    setBusy("sync");
    setFeedback(null);
    try {
      const info = await getTrackingInfo(tracking);
      const status = latestStatus(info);
      await saveOrder({
        ecotrack_status: status ?? order.ecotrack_status ?? "unknown",
        ecotrack_synced_at: new Date().toISOString(),
      });
      setFeedback({ kind: "ok", text: status ? `Statut : ${status}` : "Suivi actualisé" });
      refresh();
    } catch (err) {
      setFeedback({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  const spin = (key: Busy, icon: React.ReactNode) =>
    busy === key ? <Loader2 size={14} className="animate-spin" /> : icon;

  return (
    <BentoPanel className="p-6 md:col-span-3">
      <div className="mb-4 flex items-center gap-2">
        <Truck size={18} className="text-brand" />
        <h3 className="font-display text-lg text-ink">Livraison — ECOTRACK</h3>
      </div>

      {tracking ? (
        <dl className="mb-5 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide2 text-muted">N° de suivi</dt>
            <dd dir="ltr" className="font-mono text-sm text-ink">{tracking}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide2 text-muted">Statut ECOTRACK</dt>
            <dd className="text-sm capitalize text-ink">{order.ecotrack_status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide2 text-muted">Dernière synchro</dt>
            <dd className="text-sm text-ink">
              {order.ecotrack_synced_at
                ? new Date(order.ecotrack_synced_at).toLocaleString("fr-DZ")
                : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mb-5 text-sm text-muted">
          Cette commande n'a pas encore été expédiée via ECOTRACK. Vérifiez la connexion,
          puis créez le colis — son numéro de suivi sera enregistré ici.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={busy !== null}
          onClick={onCheck}
        >
          {spin("check", <PlugZap size={14} />)} Vérifier la connexion
        </Button>

        {!tracking && (
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy !== null}
            onClick={onShip}
          >
            {spin("ship", <Truck size={14} />)} Expédier via ECOTRACK
          </Button>
        )}

        {tracking && (
          <>
            <Button
              size="sm"
              className="w-full sm:w-auto"
              disabled={busy !== null}
              onClick={onDispatch}
            >
              {spin("dispatch", <CheckCircle2 size={14} />)} Remettre au transporteur
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={busy !== null}
              onClick={onSync}
            >
              {spin("sync", <RefreshCw size={14} />)} Actualiser le suivi
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={busy !== null}
              onClick={onLabel}
            >
              {spin("label", <FileDown size={14} />)} Étiquette
            </Button>
          </>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.kind === "ok"
              ? "border-brand/40 bg-brand/5 text-ink"
              : "border-red-500/40 bg-red-500/5 text-red-500"
          }`}
        >
          {feedback.kind === "ok" ? (
            <CheckCircle2 size={16} className="mt-px shrink-0 text-brand" />
          ) : (
            <AlertCircle size={16} className="mt-px shrink-0" />
          )}
          <span className="break-words">{feedback.text}</span>
        </div>
      )}
    </BentoPanel>
  );
}
