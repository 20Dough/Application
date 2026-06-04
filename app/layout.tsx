import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "HiveMind — Human + AI Team Workspace",
  description:
    "A collaborative workspace where teams of humans and teams of AI work together inside shared project rooms.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the theme before paint to avoid a flash of the wrong colors. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full bg-hive-bg text-hive-text">{children}</body>
    </html>
  );
}
