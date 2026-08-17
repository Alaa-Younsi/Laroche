// Browser-side ECOTRACK client. Never talks to ECOTRACK directly — every
// call goes through our own /api/ecotrack proxy, which holds the secret token
// server-side and gates on the caller's Supabase admin session. This module
// only attaches that session's access token so the proxy can authorize.
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types/db";

export interface EcotrackError {
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
  // The ECOTRACK endpoint travels as the `path` query param, not as extra URL
  // segments: the `[...path]` catch-all this used to call was never registered
  // as a function on Vercel, so in production every call landed on the SPA's
  // index.html instead of the proxy. See api/ecotrack/proxy.ts.
  params.set("path", subpath);
  const headers: Record<string, string> = { ...(await authHeaders()) };
  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return fetch(`/api/ecotrack/proxy?${params.toString()}`, init);
}

function messageOf(raw: unknown, fallback: string): string {
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

/** JSON call that throws a typed EcotrackError on any non-2xx response. */
async function callJson<T = unknown>(subpath: string, opts: CallOptions = {}): Promise<T> {
  const res = await raw(subpath, opts);
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const error: EcotrackError = {
      status: res.status,
      message: messageOf(parsed, `ECOTRACK error (HTTP ${res.status})`),
      raw: parsed,
    };
    throw error;
  }
  return parsed as T;
}

export function isEcotrackError(err: unknown): err is EcotrackError {
  return typeof err === "object" && err !== null && "status" in err && "message" in err;
}

// ---- Read-only endpoints (safe to call any time) ------------------------

export interface ValidateResult {
  success?: boolean;
  message?: string;
}

/** Confirms the server token is accepted by ECOTRACK. Read-only. */
export function validateToken(): Promise<ValidateResult> {
  return callJson<ValidateResult>("validate/token");
}

/** ECOTRACK's active wilayas. Shape varies by deployment, so kept as unknown
 *  and normalized by resolveWilayaCode below. */
export function getWilayas(): Promise<unknown> {
  return callJson("get/wilayas");
}

export function getFees(): Promise<unknown> {
  return callJson("get/fees");
}

export interface TrackingUpdate {
  remarque?: string;
  station?: string;
  livreur?: string;
  created_at?: string;
  tracking?: string;
}

/** Full status history for a parcel. */
export function getTrackingInfo(tracking: string): Promise<unknown> {
  return callJson("get/tracking/info", { query: { tracking } });
}

/** Downloads the shipping label PDF for a parcel as a Blob. */
export async function getLabel(tracking: string): Promise<Blob> {
  const res = await raw("get/order/label", { query: { tracking } });
  if (!res.ok) {
    throw {
      status: res.status,
      message: `Impossible de récupérer l'étiquette (HTTP ${res.status})`,
      raw: null,
    } satisfies EcotrackError;
  }
  return res.blob();
}

// ---- Write endpoints ----------------------------------------------------

export interface CreateOrderPayload {
  reference: string;
  nom_client: string;
  telephone: string;
  telephone_2?: string;
  adresse: string;
  code_postal?: string;
  commune: string;
  code_wilaya: number;
  montant: number;
  remarque?: string;
  produit: string;
  quantite: number;
  stop_desk: 0 | 1;
  type?: number;
  weight?: number;
  fragile?: 0 | 1;
}

export interface CreateOrderResult {
  success?: boolean;
  tracking?: string;
  message?: string;
}

/** Creates the parcel in ECOTRACK. On success returns its tracking number. */
export function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  return callJson<CreateOrderResult>("create/order", { method: "POST", query: { ...payload } });
}

/** Dispatches an already-created parcel to the courier ("expédier"). */
export function dispatchOrder(tracking: string): Promise<{ success?: boolean; message?: string }> {
  return callJson("valid/order", { method: "POST", query: { tracking } });
}

// ---- Order → ECOTRACK mapping ------------------------------------------

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
 * Checkout offers all 69 (0007_wilayas_69.sql) but ECOTRACK's /get/wilayas
 * still returns the classic 58 — verified live against this tenant, ids 1‑58.
 * Without this fallback every order from one of these towns died at
 * "Code wilaya introuvable" and could never be shipped, which is the shape of
 * the failure the client reported.
 *
 * Mapped by real geography (where the parcel actually has to travel), not by
 * the "ex …" comments in 0007, two of which name the wrong parent. The town
 * itself still rides along as the `commune`, so the courier keeps the precise
 * destination. Parents are NAMES, resolved through ECOTRACK's own live list —
 * numeric codes differ per deployment, so hardcoding them would rot.
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
 * Resolve an ECOTRACK numeric wilaya code from a wilaya name, using ECOTRACK's
 * own /get/wilayas list as the source of truth (codes differ per deployment
 * and Algeria's 2026 reorg added 59–69). Handles both response shapes seen in
 * the wild: `{ "1": "Adrar", ... }` and `[{ id, wilaya_name }, ...]`.
 *
 * Falls back to the parent wilaya for the 11 post-reorg splits ECOTRACK does
 * not carry yet.
 */
export function resolveWilayaCode(wilayas: unknown, wilayaName: string): number | null {
  const direct = matchWilayaCode(wilayas, wilayaName);
  if (direct !== null) return direct;

  const parent = parentWilayaFor(wilayaName);
  return parent ? matchWilayaCode(wilayas, parent) : null;
}

function matchWilayaCode(wilayas: unknown, wilayaName: string): number | null {
  const target = normalize(wilayaName);

  if (Array.isArray(wilayas)) {
    for (const entry of wilayas) {
      if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        const name = rec.wilaya_name ?? rec.name ?? rec.nom ?? rec.wilaya;
        const code = rec.wilaya_id ?? rec.id ?? rec.code ?? rec.code_wilaya;
        if (typeof name === "string" && normalize(name) === target) {
          const n = Number(code);
          if (Number.isFinite(n)) return n;
        }
      }
    }
    return null;
  }

  if (wilayas && typeof wilayas === "object") {
    for (const [code, name] of Object.entries(wilayas as Record<string, unknown>)) {
      if (typeof name === "string" && normalize(name) === target) {
        const n = Number(code);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

/** Build the create/order payload from one of our orders + a resolved code. */
export function orderToPayload(order: Order, codeWilaya: number): CreateOrderPayload {
  const produit =
    (order.order_items ?? [])
      .map((item) => `${item.name_fr} x${item.quantity}`)
      .join(", ") || order.order_number;
  const quantite = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0) || 1;

  // When the order's wilaya was carved out in the 2026 reorg the parcel ships
  // through its parent wilaya, so name the real destination in the remark —
  // otherwise the courier only ever sees the parent and the commune.
  const parent = parentWilayaFor(order.wilaya);
  const remarque = [parent ? `Wilaya : ${order.wilaya}` : "", order.notes ?? ""]
    .filter(Boolean)
    .join(" — ");

  // ECOTRACK rejects a blank adresse/commune outright (422). Fall back through
  // whatever the order does carry rather than posting an empty required field.
  const adresse = order.address?.trim() || order.city?.trim() || order.wilaya;
  const commune = order.city?.trim() || order.wilaya;

  return {
    reference: order.order_number,
    nom_client: order.customer_name,
    telephone: order.customer_phone.replace(/[^\d+]/g, ""),
    adresse,
    commune,
    code_wilaya: codeWilaya,
    montant: order.total,
    remarque,
    produit,
    quantite,
    // stop_desk = 1 → office/desk pickup; 0 → home delivery
    stop_desk: order.delivery_type === "office" ? 1 : 0,
    type: 1,
    weight: 1,
    fragile: 0,
  };
}
