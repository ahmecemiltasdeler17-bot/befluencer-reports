export function ReportEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 p-8 text-center">
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </section>
  );
}
