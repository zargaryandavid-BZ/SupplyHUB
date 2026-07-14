import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SupplyerHUB — Print House Partner Management",
  description: "Route client orders to partners, collect quotes, award the best offer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
