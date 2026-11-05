export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parsePriceValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 && value < 1_000_000_000 ? roundMoney(value) : null;
  }
  if (typeof value !== "string") return null;

  let text = value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d]/g, "")
    .trim()
    .toLowerCase();

  if (!text) return null;
  text = text.replace(/(zł|pln|eur|usd|gbp|chf|sek|nok|dkk|czk|huf|uah|jpy|cad|aud|\$|€|£|¥)/gi, "");
  text = text.replace(/[^\d.,'-]/g, "").trim();
  text = text.replace(/'/g, "");
  if (!text) return null;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    text = text.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") text = text.replace(",", ".");
  } else if (comma >= 0) {
    const decimals = text.length - comma - 1;
    if (decimals > 0 && decimals <= 2) {
      text = text.replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (dot >= 0) {
    const decimals = text.length - dot - 1;
    if (decimals !== 1 && decimals !== 2) {
      const groups = text.split(".");
      if (groups.length > 2 || (groups[0]?.length ?? 0) > 3) {
        text = groups.join("");
      }
    }
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric >= 1_000_000_000) return null;
  return roundMoney(numeric);
}

export function normalizeCurrency(value: unknown, fallback = "PLN"): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cleaned)) return cleaned;
  if (cleaned === "ZŁ" || cleaned === "ZL") return "PLN";
  if (cleaned === "€") return "EUR";
  if (cleaned === "$") return "USD";
  if (cleaned === "£") return "GBP";
  return fallback;
}
