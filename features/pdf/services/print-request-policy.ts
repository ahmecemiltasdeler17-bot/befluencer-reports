import { isAllowedPrintUrl } from "@/features/pdf/origin";

export type PrintRequestDecision = "continue" | "abort";

export type PrintRequestInput = {
  url: string;
  resourceType: string;
  isNavigationRequest: boolean;
  appOrigin: string;
};

/**
 * Passive assets carry no scripts and cannot navigate the page. Thumbnails and
 * avatars come from provider CDNs whose hostnames are not predictable
 * (TikTok signs them per region and shard), so these are allowed from any host
 * and simply fall back to the deterministic poster when they fail.
 */
const PASSIVE_RESOURCE_TYPES = new Set(["image", "font", "media"]);

/**
 * Decides whether a request made by the print page may proceed.
 *
 * Report links point at external social profiles and posts. Those hrefs must
 * survive into the DOM so Chrome writes clickable annotations into the PDF, but
 * they must never be *followed* during generation — a navigation away from the
 * print page would capture the wrong document. Any navigation request that is
 * not the print page itself is therefore aborted.
 */
export function decidePrintRequest(
  input: PrintRequestInput
): PrintRequestDecision {
  const sameOrigin = isAllowedPrintUrl(input.url, input.appOrigin);

  if (input.isNavigationRequest) {
    return sameOrigin ? "continue" : "abort";
  }

  if (PASSIVE_RESOURCE_TYPES.has(input.resourceType)) {
    return "continue";
  }

  if (input.url.startsWith("data:")) {
    return "continue";
  }

  // Documents, scripts and styles may only come from the application itself.
  return sameOrigin ? "continue" : "abort";
}
