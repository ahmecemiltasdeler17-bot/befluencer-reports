"use client";

export function ReportGenerationFeedback({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  if (!success && !error) {
    return null;
  }

  return (
    <div className="space-y-2">
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
