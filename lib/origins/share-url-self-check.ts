/**
 * Fake 64-hex token used only in offline URL shape checks.
 * Never create a real share with this value.
 */
export const FAKE_SHARE_TOKEN_FOR_CHECKS = "a".repeat(64);

export type ExpectedPublicShareUrls = {
  report: string;
  list: string;
};

/**
 * Pure helper: given a trusted public origin + fake token, returns the
 * absolute share URLs production must mint.
 */
export function expectedPublicShareUrls(
  publicReportOrigin: string,
  fakeToken: string = FAKE_SHARE_TOKEN_FOR_CHECKS
): ExpectedPublicShareUrls {
  const origin = new URL(publicReportOrigin).origin;
  return {
    report: `${origin}/r/${fakeToken}`,
    list: `${origin}/lists/${fakeToken}`,
  };
}

export function assertShareUrlsMatchPublicOrigin(
  publicReportOrigin: string,
  reportUrl: string,
  listUrl: string,
  fakeToken: string = FAKE_SHARE_TOKEN_FOR_CHECKS
): boolean {
  const expected = expectedPublicShareUrls(publicReportOrigin, fakeToken);
  return reportUrl === expected.report && listUrl === expected.list;
}
