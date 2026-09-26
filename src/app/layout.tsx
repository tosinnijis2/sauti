import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sauti | Smarter local trade",
  description: "A modern marketplace for discovering prices, listing products, and connecting traders.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
