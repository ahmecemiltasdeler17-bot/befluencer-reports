export function ReportEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-bf-border bg-bf-surface/30 p-8 text-center">
      <h3 className="text-sm font-medium text-bf-text/90">{title}</h3>
      <p className="mt-2 text-sm text-bf-steel">{description}</p>
    </section>
  );
}
