import writeXlsxFile from "write-excel-file/browser";
import type { NewsletterSubscriber } from "@/types/db";

// The DB's email check constraint allows a leading +/- (`[A-Za-z0-9._%+-]+@…`),
// so "-evil@x.co" is a valid stored email; some apps still treat a leading
// =/+/-/@ as a formula on paste.
function excelSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export async function exportNewsletterToExcel(
  subscribers: NewsletterSubscriber[],
): Promise<void> {
  const schema = [
    { column: "Email", type: String, value: (s: NewsletterSubscriber) => excelSafe(s.email), width: 32 },
    { column: "Statut", type: String, value: (s: NewsletterSubscriber) => (s.active ? "Actif" : "Inactif"), width: 12 },
    {
      column: "Date",
      type: String,
      value: (s: NewsletterSubscriber) => new Date(s.created_at).toLocaleDateString("fr-DZ"),
      width: 14,
    },
  ];
  const today = new Date().toISOString().slice(0, 10);
  await writeXlsxFile(subscribers, { schema, fileName: `newsletter-${today}.xlsx` });
}
