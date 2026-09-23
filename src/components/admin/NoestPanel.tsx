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
  Ban,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getWilayas,
  resolveWilayaCode,
  orderToPayload,
  createOrder,
  dispatchOrder,
  cancelOrder,
  getLabel,
  getTrackingInfo,
  isNoestError,
  type NoestError,
} from "@/lib/noest";
import type { Order } from "@/types/db";

type Busy = null | "check" | "ship" | "dispatch" | "label" | "sync" | "cancel";
type Feedback = { kind: "ok" | "err"; text: string } | null;

function errText(err: unknown): string {
  if (isNoestError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Best-effort latest-status extraction from the trackings/info payload,
 *  whose exact shape isn't documented anywhere public. Returns null if
 *  unrecognized rather than guessing. */
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
    const activities = rec.activities ?? rec.history ?? rec.OrderHistory;
    if (Array.isArray(activities) && activities.length > 0) {
      return pickFrom(activities[activities.length - 1]);
    }
    return pickFrom(info);
  }
  return null;
}

export function NoestPanel({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [stationCode, setStationCode] = useState("");
  const [cancelArmed, setCancelArmed] = useState(false);

  const tracking = order.delivery_tracking ?? null;
  const isPointRelais = order.delivery_type === "office";

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
      const wilayas = await getWilayas();
      setFeedback({
        kind: "ok",
        text: `Connexion NOEST OK — ${wilayas.length} wilayas actives.`,
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
      if (isPointRelais && !stationCode.trim()) {
        throw {
          status: 0,
          message: "Indiquez le code du bureau NOEST (ex: 16A) avant d'expédier en point relais.",
          raw: null,
        } satisfies NoestError;
      }
      const wilayas = await getWilayas();
      const code = resolveWilayaCode(wilayas, order.wilaya);
      if (code === null) {
        throw { status: 0, message: `Code wilaya introuvable pour « ${order.wilaya} »`, raw: null };
      }
      const result = await createOrder(orderToPayload(order, code, stationCode.trim() || null));
      const trackingNo = result.tracking;
      if (!trackingNo) {
        throw {
          status: 0,
          message: result.message || "NOEST n'a pas renvoyé de numéro de suivi",
          raw: result,
        };
      }
      // The parcel now exists at NOEST — for real, immediately, with no draft
      // step to catch a mistake first. If persisting the tracking number
      // fails we must NOT let the operator retry blind — a second click
      // would create a duplicate parcel. Surface the number so it can be
      // pasted back (or the order cancelled with cancelOrder).
      try {
        await saveOrder({
          delivery_tracking: trackingNo,
          delivery_status: "created",
          delivery_synced_at: new Date().toISOString(),
          status: "shipped",
        });
      } catch (saveErr) {
        throw {
          status: 0,
          message:
            `Colis créé chez NOEST (suivi ${trackingNo}) mais l'enregistrement ` +
            `a échoué : ${errText(saveErr)}. Ne pas réexpédier — notez ce numéro.`,
          raw: saveErr,
        } satisfies NoestError;
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
          delivery_status: "dispatched",
          delivery_synced_at: new Date().toISOString(),
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

  async function onCancel() {
    if (!tracking) return;
    if (!cancelArmed) {
      setCancelArmed(true);
      window.setTimeout(() => setCancelArmed(false), 4000);
      return;
    }
    setCancelArmed(false);
    setBusy("cancel");
    setFeedback(null);
    try {
      const result = await cancelOrder(tracking);
      const ok = result.success === true;
      if (ok) {
        await saveOrder({
          delivery_tracking: null,
          delivery_status: "cancelled",
          delivery_synced_at: new Date().toISOString(),
          status: "pending",
        });
        refresh();
      }
      setFeedback({
        kind: ok ? "ok" : "err",
        text: result.message || (ok ? "Colis annulé chez NOEST" : "Échec de l'annulation"),
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
        delivery_status: status ?? order.delivery_status ?? "unknown",
        delivery_synced_at: new Date().toISOString(),
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
        <h3 className="font-display text-lg text-ink">Livraison — NOEST</h3>
      </div>

      {tracking ? (
        <dl className="mb-5 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide2 text-muted">N° de suivi</dt>
            <dd dir="ltr" className="font-mono text-sm text-ink">{tracking}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide2 text-muted">Statut NOEST</dt>
            <dd className="text-sm capitalize text-ink">{order.delivery_status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide2 text-muted">Dernière synchro</dt>
            <dd className="text-sm text-ink">
              {order.delivery_synced_at
                ? new Date(order.delivery_synced_at).toLocaleString("fr-DZ")
                : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="mb-5 space-y-3">
          <p className="text-sm text-muted">
            Cette commande n'a pas encore été expédiée via NOEST. NOEST crée le colis
            immédiatement dès l'appel — vérifiez les informations avant de cliquer.
          </p>
          {order.payment_status === "paid" && (
            <div className="flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/5 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 size={16} className="mt-px shrink-0" />
              <span>
                Commande déjà payée en ligne — le montant à encaisser envoyé à NOEST sera
                automatiquement 0 DA.
              </span>
            </div>
          )}
          {isPointRelais && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">
                Code bureau NOEST (point relais)
              </label>
              <Input
                placeholder="ex : 16A"
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value)}
                className="max-w-xs"
              />
              <p className="mt-1 text-xs text-muted">
                NOEST n'expose pas la liste des bureaux par API — retrouvez le code du bureau
                le plus proche de « {order.city || order.wilaya} » dans votre tableau de bord
                NOEST (Bureaux) avant d'expédier.
              </p>
            </div>
          )}
        </div>
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
            {spin("ship", <Truck size={14} />)} Expédier via NOEST
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
            <Button
              variant="outline"
              size="sm"
              className="w-full border-red-500/40 text-red-500 hover:bg-red-500/5 sm:w-auto"
              disabled={busy !== null}
              onClick={onCancel}
            >
              {spin("cancel", <Ban size={14} />)} {cancelArmed ? "Confirmer l'annulation ?" : "Annuler le colis"}
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
