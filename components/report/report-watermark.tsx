/**
 * Decorative diagonal “BeFluencer” brand watermark for report surfaces only.
 * Branding / light deterrence — not copyright protection.
 *
 * Tiling is CSS-driven (SVG data URI background). No DOM text nodes, so
 * screen readers never hear repeated labels.
 */
export function ReportWatermark() {
  return (
    <div
      className="report-watermark"
      data-report-watermark=""
      aria-hidden="true"
    />
  );
}
