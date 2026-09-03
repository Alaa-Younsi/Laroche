import writeXlsxFile from "write-excel-file/browser";
import type { Order } from "@/types/db";
import { formatPrice } from "@/lib/format";

// Even in a real .xlsx (where a plain string cell is never evaluated), some
// spreadsheet apps still auto-detect a leading =/+/-/@ as a formula on paste —
// keep the guard.
function excelSafe(value: string | null | undefined): string {
  const v = value ?? "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Site",
  manual: "Manuelle",
};

type Col = { column: string; value: (o: Order) => string; width?: number };

const COLUMNS: Col[] = [
  { column: "N° Commande", value: (o) => excelSafe(o.order_number), width: 22 },
  { column: "Client", value: (o) => excelSafe(o.customer_name), width: 22 },
  { column: "Téléphone", value: (o) => excelSafe(o.customer_phone), width: 14 },
  { column: "Wilaya", value: (o) => excelSafe(o.wilaya), width: 16 },
  { column: "Ville", value: (o) => excelSafe(o.city), width: 16 },
  { column: "Adresse", value: (o) => excelSafe(o.address), width: 28 },
  { column: "Statut", value: (o) => STATUS_LABELS[o.status] ?? o.status, width: 12 },
  { column: "Source", value: (o) => SOURCE_LABELS[o.source ?? "website"] ?? "Site", width: 10 },
  { column: "Suivi ECOTRACK", value: (o) => excelSafe(o.ecotrack_tracking), width: 18 },
  { column: "Livraison", value: (o) => (o.delivery_type === "home" ? "Domicile" : "Bureau"), width: 12 },
  { column: "Sous-total", value: (o) => formatPrice(o.subtotal), width: 14 },
  { column: "Frais livraison", value: (o) => formatPrice(o.shipping), width: 14 },
  { column: "Remise", value: (o) => formatPrice(o.discount), width: 12 },
  { column: "Total", value: (o) => formatPrice(o.total), width: 14 },
  { column: "Notes", value: (o) => excelSafe(o.notes), width: 30 },
  { column: "Date", value: (o) => new Date(o.created_at).toLocaleDateString("fr-DZ"), width: 14 },
];

export async function exportOrdersToExcel(orders: Order[]): Promise<void> {
  const schema = COLUMNS.map((c) => ({
    column: c.column,
    type: String,
    value: c.value,
    width: c.width,
  }));
  const today = new Date().toISOString().slice(0, 10);
  await writeXlsxFile(orders, { schema, fileName: `commandes-${today}.xlsx` });
}
