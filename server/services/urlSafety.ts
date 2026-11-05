import dns from "node:dns/promises";
import net from "node:net";
import { AppError } from "../lib/errors";

type LookupAddress = { address: string; family: number };

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".home.arpa",
  ".lan",
  ".intranet",
  ".test",
  ".invalid",
  ".example"
];

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function ipv4FromIpv6(address: string): string | null {
  const normalized = address.toLowerCase().split("%")[0];
  const groups = normalized.split(":");

  const last = groups[groups.length - 1] ?? "";
  if (last.includes(".") && net.isIP(last) === 4) return last;

  // IPv4-mapped IPv6 (::ffff:7f00:1 and its expanded forms).
  const mappedIndex = groups.lastIndexOf("ffff");
  if (mappedIndex !== -1 && mappedIndex === groups.length - 3) {
    const high = Number.parseInt(groups[mappedIndex + 1] || "0", 16);
    const low = Number.parseInt(groups[mappedIndex + 2] || "0", 16);
    if (Number.isFinite(high) && Number.isFinite(low)) {
      return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
    }
  }

  return null;
}

export function isPrivateIp(address: string): boolean {
  const ipVersion = net.isIP(address);

  if (ipVersion === 4) {
    const parts = parseIpv4(address);
    if (!parts) return true;
    const [a, b, c] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    if (normalized === "::" || normalized === "::1") return true;

    const mappedIpv4 = ipv4FromIpv6(normalized);
    if (mappedIpv4 && isPrivateIp(mappedIpv4)) return true;

    const groups = normalized.split(":");
    const firstGroup = groups[0] === "" ? 0 : Number.parseInt(groups[0], 16);
    const secondGroup = Number.parseInt(groups[1] ?? "0", 16);

    if (!Number.isFinite(firstGroup)) return true;
    if (firstGroup === 0) return true;
    if ((firstGroup & 0xfe00) === 0xfc00) return true; // unique local
    if ((firstGroup & 0xffc0) === 0xfe80) return true; // link local
    if ((firstGroup & 0xffc0) === 0xfec0) return true; // deprecated site local
    if ((firstGroup & 0xff00) === 0xff00) return true; // multicast
    if (firstGroup === 0x2001 && secondGroup === 0x0db8) return true; // documentation

    return false;
  }

  return true;
}

export function normalizeProductUrl(input: string): { url: string; normalizedUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new AppError(400, "Enter a valid product URL.", "INVALID_URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(400, "Only HTTP and HTTPS links are supported.", "INVALID_PROTOCOL");
  }

  if (parsed.username || parsed.password) {
    throw new AppError(400, "URLs containing credentials are not supported.", "INVALID_URL");
  }

  parsed.hash = "";

  const trackingParameters = [
    /^utm_/i,
    /^gclid$/i,
    /^fbclid$/i,
    /^msclkid$/i,
    /^dclid$/i,
    /^mc_cid$/i,
    /^mc_eid$/i,
    /^ref$/i,
    /^affiliate/i
  ];
  for (const key of [...parsed.searchParams.keys()]) {
    if (trackingParameters.some((pattern) => pattern.test(key))) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  const cleaned = parsed.toString();
  const normalized = new URL(cleaned);
  normalized.hostname = normalized.hostname.toLowerCase();
  let normalizedString = normalized.toString();
  if (normalizedString.endsWith("/") && normalized.pathname !== "/") {
    normalizedString = normalizedString.slice(0, -1);
  }

  return { url: cleaned, normalizedUrl: normalizedString };
}

export async function resolvePublicAddresses(url: URL): Promise<LookupAddress[]> {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (!hostname || BLOCKED_SUFFIXES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix))) {
    throw new AppError(400, "Local and internal hostnames cannot be fetched.", "BLOCKED_HOST");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new AppError(400, "Private and internal network addresses are blocked.", "BLOCKED_HOST");
    }
    return [{ address: hostname, family: net.isIP(hostname) }];
  }

  let addresses: LookupAddress[];
  try {
    addresses = await Promise.race([
      dns.lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS lookup timed out")), 5000)
      )
    ]);
  } catch {
    throw new AppError(400, "The store domain could not be resolved.", "DNS_FAILED");
  }

  if (!addresses.length) {
    throw new AppError(400, "The store domain could not be resolved.", "DNS_FAILED");
  }

  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new AppError(400, "That domain resolves to a private network address.", "BLOCKED_HOST");
  }

  return addresses;
}

export async function assertSafeUrl(url: URL): Promise<LookupAddress[]> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(400, "Only HTTP and HTTPS links are supported.", "INVALID_PROTOCOL");
  }
  return resolvePublicAddresses(url);
}
