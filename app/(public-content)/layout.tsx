import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Paylaşılan Creator Listesi",
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
 * Public creator-list shares — no management chrome, no login layout.
 * Access is gated by the share token RPC.
 */
export default function PublicContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
