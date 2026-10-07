import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Almoxarifado Marcon",
  description: "Gestão de estoque e depósito de sobras.",
  icons: {
    icon: "/marcon-favicon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
