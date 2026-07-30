import type { Order } from "@/types/db";
import { formatPrice } from "@/lib/format";

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

// xlsx is ~1 MB minified — imported on demand so it never weighs down a route chunk
export async function exportOrdersToExcel(orders: Order[]): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = orders.map((order) => ({
    "N° Commande": excelSafe(order.order_number),
    Client: excelSafe(order.customer_name),
    Téléphone: excelSafe(order.customer_phone),
    Wilaya: excelSafe(order.wilaya),
    Ville: excelSafe(order.city),
    Adresse: excelSafe(order.address),
    Statut: STATUS_LABELS[order.status] ?? order.status,
    Suivi_ECOTRACK: excelSafe(order.ecotrack_tracking),
    Livraison: order.delivery_type === "home" ? "Domicile" : "Bureau",
    "Sous-total": formatPrice(order.subtotal),
    Livraison_Frais: formatPrice(order.shipping),
    Remise: formatPrice(order.discount),
    Total: formatPrice(order.total),
    Notes: excelSafe(order.notes),
    Date: new Date(order.created_at).toLocaleDateString("fr-DZ"),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Commandes");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `commandes-${today}.xlsx`);
}
