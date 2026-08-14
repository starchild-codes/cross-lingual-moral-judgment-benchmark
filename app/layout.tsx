import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moral Judgment Benchmark",
  description: "Cross-lingual moral judgment research operations dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
