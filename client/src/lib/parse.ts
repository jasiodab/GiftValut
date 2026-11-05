export function parsePriceString(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

export function toPriceInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
