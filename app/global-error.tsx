"use client";

/**
 * Root error boundary. Must not depend on layout providers or shared UI
 * contexts — Next.js renders this instead of the root layout when an
 * uncaught error bubbles up, and the internal /_global-error prerender
 * has no App Router context available.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#09090B",
          color: "#fff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            Bir şeyler ters gitti
          </h1>
          <p style={{ marginTop: 12, color: "#a1a1aa", fontSize: 14 }}>
            Sayfa yüklenirken beklenmeyen bir hata oluştu.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #3f3f46",
              background: "#18181b",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
