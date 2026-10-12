import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Inter_Tight } from "next/font/google";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { themeBoot } from "@/lib/theme";
import "./globals.css";

const sans = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

const display = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter-tight",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: copy.product,
    template: `%s · ${copy.product}`,
  },
  description: copy.productLine,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#11110F" },
    { media: "(prefers-color-scheme: light)", color: "#F7F6F2" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="az"
      className={`${sans.variable} ${display.variable} ${mono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
