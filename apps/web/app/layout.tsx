import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "PERPEX — Perpetual Exchange",
  description: "Trade perpetual crypto futures with leverage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-base text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
