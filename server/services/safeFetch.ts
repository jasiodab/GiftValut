import { Agent, fetch } from "undici";
import { AppError } from "../lib/errors";
import { assertSafeUrl } from "./urlSafety";

export type SafeFetchResult = {
  url: URL;
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: Buffer;
};

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GiftVault/1.0",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/*;q=0.8,*/*;q=0.7",
  "accept-language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7"
};

type SafeFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
};

export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 12000;
  const maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = new URL(input.toString());

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const addresses = await assertSafeUrl(currentUrl);
    const address = addresses[0];

    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, _lookupOptions, callback) => {
          callback(null, [{ address: address.address, family: address.family }]);
        }
      }
    });

    let response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        dispatcher,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { ...DEFAULT_HEADERS, ...options.headers }
      });
    } catch (error) {
      await dispatcher.close();
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new AppError(504, "The store took too long to respond.", "FETCH_TIMEOUT");
      }
      throw new AppError(502, "The store could not be reached.", "FETCH_FAILED");
    }

    try {
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new AppError(502, "The store returned an invalid redirect.", "BAD_REDIRECT");
        }
        if (redirectCount === maxRedirects) {
          throw new AppError(502, "The store redirected too many times.", "TOO_MANY_REDIRECTS");
        }
        const nextUrl = new URL(location, currentUrl);
        if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
          throw new AppError(400, "The redirect pointed to an unsupported protocol.", "INVALID_REDIRECT");
        }
        currentUrl = nextUrl;
        continue;
      }

      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (declaredLength > maxBytes) {
        throw new AppError(413, "The page is too large to process safely.", "RESPONSE_TOO_LARGE");
      }

      if (!response.body) {
        return {
          url: currentUrl,
          status: response.status,
          contentType: response.headers.get("content-type") ?? "",
          headers: Object.fromEntries(response.headers.entries()),
          body: Buffer.alloc(0)
        };
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new AppError(413, "The response exceeded the safe size limit.", "RESPONSE_TOO_LARGE");
        }
        chunks.push(value);
      }

      return {
        url: currentUrl,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        headers: Object.fromEntries(response.headers.entries()),
        body: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
        };
    } finally {
      await dispatcher.close();
    }
  }

  throw new AppError(502, "The store redirected too many times.", "TOO_MANY_REDIRECTS");
}

export function decodeHtml(buffer: Buffer, contentType: string): string {
  let charset = contentType.match(/charset=["']?([^;"'\s]+)/i)?.[1]?.toLowerCase();
  if (!charset) {
    const head = buffer.subarray(0, 4096).toString("ascii");
    charset = head.match(/<meta[^>]+charset=["']?([^"'\s/>]+)/i)?.[1]?.toLowerCase();
  }

  try {
    return new TextDecoder(charset || "utf-8").decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}
