import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raffle Admin",
  description: "Manage spin wheel campaigns",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
