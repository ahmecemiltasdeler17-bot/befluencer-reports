/** Absolute http(s) origin with no path, query, fragment or credentials. */
export type ConfiguredOrigin = string;

export type PlatformOrigins = {
  /** Internal management app — e.g. https://app.befluencer.co */
  app: ConfiguredOrigin;
  /** Public report links — e.g. https://reports.befluencer.co (falls back to app) */
  publicReport: ConfiguredOrigin;
  /** Future corporate site — e.g. https://befluencer.co (optional) */
  marketing: ConfiguredOrigin | null;
};

export class OriginConfigError extends Error {
  readonly code:
    | "missing"
    | "invalid_scheme"
    | "has_path"
    | "has_query"
    | "has_fragment"
    | "has_credentials"
    | "invalid_url";

  constructor(
    code: OriginConfigError["code"],
    message: string
  ) {
    super(message);
    this.name = "OriginConfigError";
    this.code = code;
  }
}
