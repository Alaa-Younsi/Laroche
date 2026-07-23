import type { NewsletterSubscriber } from "@/types/db";

// Same formula-injection guard as exportOrders.ts — the DB's email check
// constraint allows a leading +/- (`[A-Za-z0-9._%+-]+@...`), so a value like
// "-evil@x.co" is a valid stored email that would still execute as a formula
// if opened raw in Excel/Sheets.
function excelSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export async function exportNewsletterToExcel(subscribers: NewsletterSubscriber[]): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = subscribers.map((s) => ({
    Email: excelSafe(s.email),
    Statut: s.active ? "Actif" : "Inactif",
    Date: new Date(s.created_at).toLocaleDateString("fr-DZ"),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Newsletter");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `newsletter-${today}.xlsx`);
}
