import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HiveMind",
  description: "A collaborative hive of AI providers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
