export {
  isLocalhostOriginCandidate,
  isVercelRuntime,
  resolveAppUrlCandidate,
  resolveMarketingSiteUrlCandidate,
  resolvePublicReportUrlCandidate,
  resolveVercelHttpsOriginCandidate,
} from "@/lib/origins/candidates";
export {
  getAppUrl,
  getPublicReportUrl,
  joinConfiguredOriginPath,
} from "@/lib/origins/build-origin-url";
export {
  runDomainReadinessChecks,
  type DomainCheckItem,
  type DomainCheckReport,
  type DomainCheckStatus,
} from "@/lib/origins/domain-check";
export {
  assertShareUrlsMatchPublicOrigin,
  expectedPublicShareUrls,
  FAKE_SHARE_TOKEN_FOR_CHECKS,
} from "@/lib/origins/share-url-self-check";
export { getAppOrigin, isAppOriginConfigured } from "@/lib/origins/get-app-origin";
export {
  getMarketingOrigin,
  peekMarketingOrigin,
} from "@/lib/origins/get-marketing-origin";
export {
  getPublicReportOrigin,
  isPublicReportOriginConfigured,
} from "@/lib/origins/get-public-report-origin";
export {
  OriginConfigError,
  type ConfiguredOrigin,
  type PlatformOrigins,
} from "@/lib/origins/types";
export {
  isValidConfiguredOrigin,
  normalizeConfiguredOrigin,
  tryNormalizeConfiguredOrigin,
} from "@/lib/origins/validate-origin";
