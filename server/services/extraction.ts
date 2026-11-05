import * as cheerio from "cheerio";
import { normalizeProductUrl } from "./urlSafety";
import { safeFetch, decodeHtml } from "./safeFetch";
import { downloadProductImage } from "./images";
import { normalizeCurrency, parsePriceValue } from "../lib/money";
import { suggestCategory } from "./categorization";

type CategoryLike = { id: string; name: string; slug: string; color?: string; icon?: string };

export type ExtractionData = {
  name: string | null;
  url: string;
  storeName: string | null;
  storeDomain: string | null;
  description: string | null;
  imagePath: string | null;
  imageSourceUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  availability: string | null;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
};

export type ExtractionResult = {
  success: boolean;
  data: ExtractionData;
  warnings: string[];
  strategies: string[];
  error?: string;
};

function cleanText(value: unknown, maxLength = 4000): string | null {
  if (typeof value !== "string") return null;
  let text = value;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = cheerio.load(`<div>${text}</div>`).text();
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  const record = asRecord(value);
  if (record) {
    return firstString(record.url) ?? firstString(record.contentUrl) ?? firstString(record["@id"]);
  }
  return null;
}

function collectProductNodes(value: unknown, depth = 0, found: Record<string, unknown>[] = []) {
  if (depth > 8 || value == null) return found;
  if (Array.isArray(value)) {
    for (const item of value) collectProductNodes(item, depth + 1, found);
    return found;
  }
  const record = asRecord(value);
  if (!record) return found;

  const types = (Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]])
    .filter((type): type is string => typeof type === "string")
    .map((type) => type.toLowerCase());

  if (types.some((type) => type.endsWith("product") || type.endsWith("productgroup"))) {
    found.push(record);
  }

  for (const [key, child] of Object.entries(record)) {
    if (key.startsWith("@") || key === "offers" || key === "review" || key === "aggregateRating") continue;
    if (child && typeof child === "object") collectProductNodes(child, depth + 1, found);
  }
  return found;
}

function extractOfferData(node: Record<string, unknown>): {
  price: number | null;
  originalPrice: number | null;
  currency: string | null;
  availability: string | null;
} {
  const rawOffers = node.offers;
  const offers = Array.isArray(rawOffers) ? rawOffers : rawOffers ? [rawOffers] : [];
  let price: number | null = null;
  let originalPrice: number | null = null;
  let currency: string | null = null;
  let availability: string | null = null;

  for (const rawOffer of offers) {
    const offer = asRecord(rawOffer);
    if (!offer) continue;
    const specification = asRecord(offer.priceSpecification);
    const candidate =
      parsePriceValue(offer.price) ??
      parsePriceValue(offer.lowPrice) ??
      parsePriceValue(specification?.price) ??
      parsePriceValue(node.price);
    if (candidate === null) continue;

    if (price === null || candidate < price) {
      price = candidate;
      const listPrice =
        parsePriceValue(offer.listPrice) ??
        parsePriceValue(offer.msrp) ??
        parsePriceValue(specification?.listPrice);
      const highPrice = parsePriceValue(offer.highPrice);
      const possibleOriginal = listPrice ?? highPrice;
      originalPrice = possibleOriginal && possibleOriginal > candidate ? possibleOriginal : null;
      currency = firstString(offer.priceCurrency) ?? firstString(specification?.priceCurrency) ?? currency;
      availability = firstString(offer.availability) ?? availability;
    }
  }

  return { price, originalPrice, currency, availability };
}

function normalizeAvailability(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("outofstock") || normalized.includes("soldout") || normalized.includes("out of stock")) {
    return "Out of stock";
  }
  if (normalized.includes("preorder") || normalized.includes("pre-order")) return "Pre-order";
  if (normalized.includes("backorder") || normalized.includes("back order")) return "Back order";
  if (normalized.includes("limitedavailability") || normalized.includes("limited")) return "Limited availability";
  if (normalized.includes("discontinued")) return "Discontinued";
  if (normalized.includes("instock") || normalized.includes("in stock") || normalized === "available") {
    return "In stock";
  }
  return cleanText(value, 80);
}

function storeNameFromDomain(domain: string): string {
  const withoutWww = domain.replace(/^www\./, "");
  const core = withoutWww.split(".")[0] ?? withoutWww;
  return core
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function extractProduct(
  rawUrl: string,
  options: { defaultCurrency?: string; categories?: CategoryLike[]; downloadImage?: boolean; userId: string }
): Promise<ExtractionResult> {
  const { url, normalizedUrl } = normalizeProductUrl(rawUrl);
  const defaultCurrency = options.defaultCurrency ?? "PLN";
  const warnings: string[] = [];
  const strategies: string[] = [];

  let response;
  try {
    response = await safeFetch(url, { maxBytes: 6 * 1024 * 1024, timeoutMs: 15000 });
  } catch (error) {
    const message =
      error instanceof Error && typeof (error as { message?: string }).message === "string"
        ? (error as Error).message
        : "The store could not be reached.";
    return {
      success: false,
      error: message,
      warnings: ["You can still add this product and fill in the details manually."],
      strategies,
      data: emptyData(url, normalizedUrl, defaultCurrency, options.categories)
    };
  }

  if (response.status === 403 || response.status === 401) {
    return {
      success: false,
      error: "This store refused automated access.",
      warnings: ["The store blocks automated readers. Add the product manually using the details you see in your browser."],
      strategies,
      data: emptyData(response.url.toString(), normalizedUrl, defaultCurrency, options.categories)
    };
  }
  if (response.status === 429) {
    return {
      success: false,
      error: "The store is rate-limiting requests.",
      warnings: ["Please wait a while, or add this product manually. Gift Vault will not retry aggressively."],
      strategies,
      data: emptyData(response.url.toString(), normalizedUrl, defaultCurrency, options.categories)
    };
  }
  if (response.status < 200 || response.status >= 400) {
    return {
      success: false,
      error: `The store responded with HTTP ${response.status}.`,
      warnings: ["You can still add this product manually."],
      strategies,
      data: emptyData(response.url.toString(), normalizedUrl, defaultCurrency, options.categories)
    };
  }

  const contentType = response.contentType.toLowerCase();
  if (contentType && !contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("text/plain")) {
    return {
      success: false,
      error: "The link did not return a product page.",
      warnings: ["Only HTML product pages can be read automatically."],
      strategies,
      data: emptyData(response.url.toString(), normalizedUrl, defaultCurrency, options.categories)
    };
  }

  const html = decodeHtml(response.body, response.contentType);
  const $ = cheerio.load(html);

  const meta = new Map<string, string>();
  $("meta").each((_, element) => {
    const key = ($(element).attr("property") ?? $(element).attr("name") ?? $(element).attr("itemprop") ?? "")
      .trim()
      .toLowerCase();
    const content = $(element).attr("content");
    if (key && content && !meta.has(key)) meta.set(key, content.trim());
  });

  const jsonLdProducts: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const content = $(element).text();
    if (!content.trim()) return;
    try {
      jsonLdProducts.push(...collectProductNodes(JSON.parse(content)));
    } catch {
      warnings.push("One structured-data block could not be read.");
    }
  });

  const jsonProduct = jsonLdProducts[0];
  const jsonOffer = jsonProduct ? extractOfferData(jsonProduct) : null;

  const titleFromH1 = cleanText($("h1").first().text(), 300);
  const titleTag = cleanText($("title").first().text(), 300);
  const metaName =
    cleanText(meta.get("og:title"), 300) ??
    cleanText(meta.get("twitter:title"), 300) ??
    cleanText(meta.get("title"), 300) ??
    cleanText(jsonProduct?.name, 300) ??
    titleFromH1 ??
    titleTag;

  const description =
    cleanText(meta.get("og:description"), 2500) ??
    cleanText(meta.get("description"), 2500) ??
    cleanText(meta.get("twitter:description"), 2500) ??
    cleanText(jsonProduct?.description, 2500);

  const ogImage =
    firstString(meta.get("og:image:secure_url")) ??
    firstString(meta.get("og:image")) ??
    firstString(meta.get("og:image:url")) ??
    firstString(meta.get("twitter:image")) ??
    firstString(meta.get("twitter:image:src")) ??
    firstString(jsonProduct?.image);
  let imageSourceUrl: string | null = null;
  if (ogImage) {
    try {
      imageSourceUrl = new URL(ogImage, response.url).toString();
    } catch {
      warnings.push("The page referenced an invalid image URL.");
    }
  }

  const microdataPrice =
    parsePriceValue($('[itemprop="price"]').first().attr("content")) ??
    parsePriceValue($('[itemprop="price"]').first().text()) ??
    parsePriceValue($("[data-price]").first().attr("data-price"));
  const metaPrice =
    parsePriceValue(meta.get("product:price:amount")) ??
    parsePriceValue(meta.get("og:price:amount")) ??
    parsePriceValue(meta.get("product:sale_price:amount")) ??
    parsePriceValue(meta.get("price"));
  const currentPrice = jsonOffer?.price ?? metaPrice ?? microdataPrice;

  const metaOriginal =
    parsePriceValue(meta.get("product:original_price:amount")) ??
    parsePriceValue(meta.get("og:price:original_amount")) ??
    parsePriceValue(meta.get("product:list_price:amount")) ??
    parsePriceValue(meta.get("product:original-price"));
  const originalPrice =
    (jsonOffer?.originalPrice && currentPrice && jsonOffer.originalPrice > currentPrice
      ? jsonOffer.originalPrice
      : null) ??
    (metaOriginal && currentPrice && metaOriginal > currentPrice ? metaOriginal : null);

  const currency = normalizeCurrency(
    jsonOffer?.currency ??
      meta.get("product:price:currency") ??
      meta.get("og:price:currency") ??
      $('[itemprop="priceCurrency"]').first().attr("content") ??
      $('[itemprop="priceCurrency"]').first().text(),
    defaultCurrency
  );

  const availability = normalizeAvailability(
    jsonOffer?.availability ??
      meta.get("product:availability") ??
      meta.get("og:availability") ??
      $('[itemprop="availability"]').first().attr("href") ??
      $('[itemprop="availability"]').first().attr("content")
  );

  const ogSiteName = cleanText(meta.get("og:site_name"), 100);
  const applicationName = cleanText(meta.get("application-name"), 100);
  const storeDomain = response.url.hostname.replace(/^www\./, "");
  const storeName = ogSiteName ?? applicationName ?? storeNameFromDomain(storeDomain);

  if (jsonProduct) strategies.push("JSON-LD");
  if (meta.has("og:title") || meta.has("og:image") || meta.has("og:price:amount")) strategies.push("Open Graph");
  if (meta.size) strategies.push("Meta tags");
  if (titleFromH1 || titleTag) strategies.push("Page title");

  if (!currentPrice) warnings.push("No reliable price was found on the page. You can enter it manually.");
  if (!description) warnings.push("No product description was available.");

  let imagePath: string | null = null;
  if (imageSourceUrl && options.downloadImage !== false) {
    const storedImage = await downloadProductImage(imageSourceUrl, response.url.toString(), options.userId);
    if (storedImage) {
      imagePath = storedImage.path;
    } else {
      warnings.push("The product image could not be downloaded. You can upload one manually.");
    }
  } else if (imageSourceUrl && options.downloadImage === false) {
    warnings.push("Image download was skipped for this update.");
  }

  const suggestedCategory =
    options.categories && options.categories.length
      ? suggestCategory(
          {
            name: metaName,
            description,
            storeName
          },
          options.categories
        )
      : null;

  const success = Boolean(metaName);
  if (!success) {
    return {
      success: false,
      error: "No product details could be identified on this page.",
      warnings: [
        ...warnings,
        "The page may require JavaScript or block automated access. Add the product manually instead."
      ],
      strategies,
      data: emptyData(response.url.toString(), normalizedUrl, defaultCurrency, options.categories)
    };
  }

  return {
    success: true,
    warnings,
    strategies,
    data: {
      name: metaName,
      url: response.url.toString(),
      storeName,
      storeDomain,
      description,
      imagePath,
      imageSourceUrl,
      currentPrice,
      originalPrice,
      currency,
      availability,
      suggestedCategoryId: suggestedCategory?.id ?? null,
      suggestedCategoryName: suggestedCategory?.name ?? null
    }
  };
}

function emptyData(
  url: string,
  normalizedUrl: string,
  currency: string,
  categories?: CategoryLike[]
): ExtractionData {
  let storeDomain = "";
  try {
    storeDomain = new URL(url || normalizedUrl).hostname.replace(/^www\./, "");
  } catch {
    storeDomain = "";
  }
  return {
    name: null,
    url,
    storeName: storeNameFromDomain(storeDomain),
    storeDomain,
    description: null,
    imagePath: null,
    imageSourceUrl: null,
    currentPrice: null,
    originalPrice: null,
    currency,
    availability: null,
    suggestedCategoryId: categories?.find((category) => category.slug === "other")?.id ?? null,
    suggestedCategoryName: categories?.find((category) => category.slug === "other")?.name ?? null
  };
}
