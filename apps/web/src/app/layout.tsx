import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raffle Spin",
  description: "Spin the wheel and win prizes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-dvh max-h-dvh overflow-hidden">
      <body className="h-dvh max-h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
}
