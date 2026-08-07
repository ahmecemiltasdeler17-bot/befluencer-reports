"use client";

import { useEffect } from "react";

function createBrowserAccessNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Records one page access after mount. Idempotent via sessionStorage nonce so
 * remounts / Strict Mode do not double-count. Never logs the token.
 */
export function PublicAccessBeacon() {
  useEffect(() => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const token = segments[0] === "r" ? segments[1] : null;

    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
      return;
    }

    const storageKey = `prs-access:${token.slice(0, 12)}`;
    let nonce = sessionStorage.getItem(storageKey);

    if (!nonce) {
      nonce = createBrowserAccessNonce();
      sessionStorage.setItem(storageKey, nonce);
    }

    const alreadySent = sessionStorage.getItem(`${storageKey}:sent`);

    if (alreadySent === "1") {
      return;
    }

    void fetch(`/api/public/reports/${token}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonce }),
      keepalive: true,
    }).then((response) => {
      if (response.ok) {
        sessionStorage.setItem(`${storageKey}:sent`, "1");
      }
    });
  }, []);

  return null;
}
