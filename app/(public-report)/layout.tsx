import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Paylaşılan Rapor",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
};

/**
 * Public shared reports — no management chrome, no login layout.
 * Auth is not required; access is gated by the share token RPC.
 */
export default function PublicReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
