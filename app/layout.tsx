import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HiveMind — Human + AI Team Workspace",
  description:
    "A collaborative workspace where teams of humans and teams of AI work together inside shared project rooms.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="h-full bg-hive-bg text-hive-text">{children}</body>
    </html>
  );
}
