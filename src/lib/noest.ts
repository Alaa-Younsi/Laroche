// Browser-side NOEST Express client. Never talks to NOEST directly — every
// call goes through our own /api/noest proxy, which holds the secret
// api_token/user_guid server-side and gates on the caller's Supabase admin
// session. This module only attaches that session's access token so the
// proxy can authorize.
//
// Replaces src/lib/ecotrack.ts after the client switched couriers. NOEST has
// no publicly documented API, so every endpoint/field name here was
// confirmed live against https://app.noest-dz.com/api/public (see
// api/_lib/noest.ts's header comment) rather than copied from a spec.
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types/db";

export interface NoestError {
  status: number;
  message: string;
  raw: unknown;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface CallOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
}

/** Raw fetch against the proxy. Returns the Response so callers can read JSON
 *  or a binary body (the label PDF) as needed. */
async function raw(subpath: string, opts: CallOptions = {}): Promise<Response> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  // The NOEST endpoint travels as the `path` query param, not as extra URL
  // segments — see api/noest/proxy.ts for why (a catch-all route never
  // registered as a function on this Vercel project).
  params.set("path", subpath);
  const headers: Record<string, string> = { ...(await authHeaders()) };
  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return fetch(`/api/noest/proxy?${params.toString()}`, init);
}

function messageOf(raw: unknown, fallback: string): string {
  // NOEST's validation failures are `{"message":"The given data was
  // invalid.","errors":{"field":["…"]}}` — that top-level message is always
  // the same generic sentence, useless on its own ("The given data was
  // invalid." told the admin nothing about which field). The per-field
  // message under `errors` is the one worth surfacing, so it must be checked
  // BEFORE falling back to the generic top-level one, not after.
  if (raw && typeof raw === "object" && "errors" in raw) {
    const errors = (raw as { errors?: unknown }).errors;
    if (errors && typeof errors === "object") {
      const firstField = Object.values(errors as Record<string, unknown>)[0];
      if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0];
    }
  }
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

/** JSON call that throws a typed NoestError on any non-2xx response. */
async function callJson<T = unknown>(subpath: string, opts: CallOptions = {}): Promise<T> {
  const res = await raw(subpath, opts);
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const error: NoestError = {
      status: res.status,
      message: messageOf(parsed, `NOEST error (HTTP ${res.status})`),
      raw: parsed,
    };
    throw error;
  }
  return parsed as T;
}

export function isNoestError(err: unknown): err is NoestError {
  return typeof err === "object" && err !== null && "status" in err && "message" in err;
}

// ---- Read-only endpoints (safe to call any time) ------------------------

export interface NoestWilaya {
  code: number;
  nom: string;
  is_active?: number;
}

/** NOEST has no dedicated token-check endpoint — get/wilayas is read-only and
 *  the cheapest call that proves the stored credentials actually work. */
export function getWilayas(): Promise<NoestWilaya[]> {
  return callJson<NoestWilaya[]>("get/wilayas");
}

/** Full status history for a parcel. Throws (404) if NOEST doesn't recognize
 *  the tracking number yet — that is a normal state right after creation. */
export function getTrackingInfo(tracking: string): Promise<unknown> {
  return callJson("get/trackings/info", { method: "POST", body: { trackings: [tracking] } });
}

/** Downloads the shipping label PDF for a parcel as a Blob. */
export async function getLabel(tracking: string): Promise<Blob> {
  const res = await raw("get/order/label", { query: { tracking } });
  if (!res.ok) {
    throw {
      status: res.status,
      message: `Impossible de récupérer l'étiquette (HTTP ${res.status})`,
      raw: null,
    } satisfies NoestError;
  }
  return res.blob();
}

// ---- Write endpoints ----------------------------------------------------

export interface CreateOrderPayload {
  reference: string;
  client: string;
  phone: string;
  phone_2?: string;
  adresse: string;
  wilaya_id: number;
  commune?: string;
  montant: number;
  remarque?: string;
  produit: string;
  // NOEST rejects a numeric JSON value here ("le champ quantite doit être
  // une chaîne de caractères", confirmed live) — it wants the count AS TEXT,
  // unlike every other numeric field in this payload.
  quantite?: string;
  poids?: number;
  can_open?: 0 | 1;
  type_id: number;
  stop_desk: 0 | 1;
  station_code?: string;
}

export interface CreateOrderResult {
  success?: boolean;
  tracking?: string;
  reference?: string | null;
  message?: string;
}

/** Creates the parcel at NOEST. Unlike ECOTRACK this ships the parcel for
 *  real immediately — there is no draft/review step to catch a mistake
 *  before it reaches the courier, which is why cancelOrder exists. */
export function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  return callJson<CreateOrderResult>("create/order", { method: "POST", body: payload });
}

/** Dispatches an already-created parcel to the courier ("expédier"). */
export function dispatchOrder(tracking: string): Promise<{ success?: boolean; message?: string }> {
  return callJson("valid/order", { method: "POST", body: { tracking } });
}

/** Cancels a parcel created by mistake. NOEST has no confirm-before-ship
 *  step, so this is the only way to undo a bad create/order call. */
export function cancelOrder(tracking: string): Promise<{ success?: boolean; message?: string }> {
  return callJson("delete/order", { method: "POST", body: { tracking } });
}

// ---- Order → NOEST mapping ------------------------------------------

/**
 * Normalize a phone number to the plain local form NOEST's `phone`/`phone_2`
 * validation requires (confirmed live: exactly 9-10 digits, no `+`, no
 * country code — a "+213…" or "213…" prefixed number is rejected outright).
 * Checkout itself only ever produces a bare 10-digit local number, but a
 * manually-entered order (ManualOrderModal) isn't bound by that regex.
 */
function toLocalPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  // "213554177107" (12 digits: country code + 9-digit local number without
  // its leading 0) → "0554177107". Only strip the prefix when the remainder
  // is a plausible mobile number length, so a real 12-digit local number
  // (were one ever to exist) isn't mangled.
  if (digits.startsWith("213") && digits.length === 12) return "0" + digits.slice(3);
  return digits;
}

/** Strip accents + lowercase for tolerant wilaya-name matching. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * The 11 wilayas Algeria's 2026 reorganization (law n°26-06) split out of
 * existing ones, mapped to the PARENT wilaya they were carved from.
 *
 * Checkout offers all 69 (0007_wilayas_69.sql) but NOEST's /get/wilayas —
 * like ECOTRACK's before it — only goes up to 58 ("la valeur de wilaya doit
 * être comprise entre 1 et 58", confirmed live). Without this fallback every
 * order from one of these towns dies at "Code wilaya introuvable" and can
 * never be shipped.
 *
 * Mapped by real geography (where the parcel actually has to travel), not by
 * the "ex …" comments in 0007, two of which name the wrong parent. The town
 * itself still rides along as the `commune`, so the courier keeps the precise
 * destination. Parents are NAMES, resolved through NOEST's own live list —
 * numeric codes could in principle differ per deployment, so hardcoding them
 * would rot.
 */
const REORG_PARENT_WILAYA: Record<string, string> = {
  aflou: "Laghouat",
  barika: "Batna",
  "el kantara": "Biskra",
  "bir el ater": "Tébessa",
  "el aricha": "Tlemcen",
  "ksar chellala": "Tiaret",
  "ain oussara": "Djelfa",
  messaad: "Djelfa",
  "ksar el boukhari": "Médéa",
  "bou saada": "M'Sila",
  "el abiodh sidi cheikh": "El Bayadh",
};

/** The parent wilaya an unknown post-reorg wilaya should ship through, if any. */
export function parentWilayaFor(wilayaName: string): string | null {
  return REORG_PARENT_WILAYA[normalize(wilayaName)] ?? null;
}

/**
 * Resolve a NOEST numeric wilaya code from a wilaya name, using NOEST's own
 * /get/wilayas list as the source of truth. Falls back to the parent wilaya
 * for the 11 post-reorg splits NOEST does not carry yet.
 */
export function resolveWilayaCode(wilayas: NoestWilaya[], wilayaName: string): number | null {
  const direct = matchWilayaCode(wilayas, wilayaName);
  if (direct !== null) return direct;

  const parent = parentWilayaFor(wilayaName);
  return parent ? matchWilayaCode(wilayas, parent) : null;
}

function matchWilayaCode(wilayas: NoestWilaya[], wilayaName: string): number | null {
  const target = normalize(wilayaName);
  for (const entry of wilayas) {
    if (normalize(entry.nom) === target) {
      const n = Number(entry.code);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/**
 * Build the create/order payload from one of our orders + a resolved wilaya
 * code. `stationCode` is required by NOEST whenever the order is Point Relais
 * (stop_desk 1) — there is no API to look up the right desk automatically
 * (see NoestPanel), so it comes from whatever the operator entered there.
 */
export function orderToPayload(
  order: Order,
  wilayaId: number,
  stationCode: string | null,
): CreateOrderPayload {
  const produit =
    (order.order_items ?? [])
      .map((item) => `${item.name_fr} x${item.quantity}`)
      .join(", ") || order.order_number;
  const quantite = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0) || 1;

  // Checkout enforces a plain local 10-digit number (0-5/6/7 + 8 digits,
  // src/lib/checkoutSchema.ts), but a manually-entered order
  // (ManualOrderModal) isn't bound by that regex — an admin can type a
  // leading "+213", spaces or dashes. NOEST's `phone` rejects anything that
  // isn't exactly 9-10 digits, so normalize a country code back to the local
  // form rather than only stripping punctuation.
  const phone = toLocalPhone(order.customer_phone);

  // When the order's wilaya was carved out in the 2026 reorg the parcel ships
  // through its parent wilaya, so name the real destination in the remark —
  // otherwise the courier only ever sees the parent and the commune.
  const parent = parentWilayaFor(order.wilaya);
  const remarque = [parent ? `Wilaya : ${order.wilaya}` : "", order.notes ?? ""]
    .filter(Boolean)
    .join(" — ");

  // NOEST rejects a blank adresse outright (422). Fall back through whatever
  // the order does carry rather than posting an empty required field.
  const adresse = order.address?.trim() || order.city?.trim() || order.wilaya;
  const commune = order.city?.trim() || order.wilaya;

  // `reference` must be at least 5 characters — pad rather than risk a
  // validation error on an otherwise-short order number format.
  const reference = order.order_number.length >= 5 ? order.order_number : `CMD-${order.order_number}`;

  const stopDesk = order.delivery_type === "office" ? 1 : 0;

  return {
    reference,
    client: order.customer_name,
    phone,
    adresse,
    wilaya_id: wilayaId,
    commune,
    montant: order.total,
    remarque,
    produit,
    quantite: String(quantite),
    poids: 1,
    can_open: 0,
    type_id: 1,
    stop_desk: stopDesk,
    ...(stopDesk === 1 && stationCode ? { station_code: stationCode } : {}),
  };
}
