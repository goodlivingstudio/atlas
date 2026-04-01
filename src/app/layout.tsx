import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geist = localFont({
  src: "./fonts/Geist-Medium.woff2",
  weight: "500",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Medium.woff2",
  weight: "500",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atlas",
  description: "Personal strategy super intelligence OS",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
