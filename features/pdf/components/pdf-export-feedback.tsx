"use client";

export function PdfExportFeedback({
  success,
  error,
  className,
}: {
  success?: string;
  error?: string;
  className?: string;
}) {
  if (!success && !error) {
    return null;
  }

  return (
    <div className={className} role="status" aria-live="polite">
      {success ? <p className="text-xs text-emerald-400">{success}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
