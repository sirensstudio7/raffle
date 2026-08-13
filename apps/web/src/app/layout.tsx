import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raffle Spin",
  description: "Spin the wheel and win prizes",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-dvh max-h-dvh overflow-hidden">
      <body className="h-dvh max-h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
}
