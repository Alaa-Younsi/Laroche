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
  const columns = [
    {
      header: "Email",
      width: 32,
      cell: (s: NewsletterSubscriber) => ({ type: String, value: excelSafe(s.email) }) as const,
    },
    {
      header: "Statut",
      width: 12,
      cell: (s: NewsletterSubscriber) => ({ type: String, value: s.active ? "Actif" : "Inactif" }) as const,
    },
    {
      header: "Date",
      width: 14,
      cell: (s: NewsletterSubscriber) => ({
        type: String,
        value: new Date(s.created_at).toLocaleDateString("fr-DZ"),
      }) as const,
    },
  ];
  const today = new Date().toISOString().slice(0, 10);
  await writeXlsxFile(subscribers, { columns }).toFile(`newsletter-${today}.xlsx`);
}
