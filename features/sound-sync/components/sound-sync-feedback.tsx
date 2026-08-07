export function SoundSyncFeedback({
  feedback,
}: {
  feedback: { type: "success" | "error"; message: string } | null;
}) {
  if (!feedback) {
    return null;
  }

  return (
    <p
      className={
        feedback.type === "success"
          ? "text-sm text-emerald-400"
          : "text-sm text-red-400"
      }
      role="status"
    >
      {feedback.message}
    </p>
  );
}
