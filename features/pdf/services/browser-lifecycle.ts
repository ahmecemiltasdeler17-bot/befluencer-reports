/**
 * Re-export pure browser lifecycle helpers for existing PDF tests/imports.
 * Implementation lives in lib/pdf/launch-browser.ts.
 */

export {
  closeBrowserQuietly,
  isServerlessRuntime,
} from "@/lib/pdf/launch-browser";
