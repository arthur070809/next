import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { isDemoModeConfigured } from "@/lib/demo-mode";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const demoMode = isDemoModeConfigured();
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="min-h-screen" data-demo-active={demoMode ? "true" : undefined}>
        {demoMode && <>
          <div aria-hidden="true" className="h-10" />
          <aside role="status" className="fixed inset-x-0 top-0 z-[100] flex h-10 items-center justify-center bg-amber-300 px-3 text-center text-xs font-bold tracking-wide text-amber-950 shadow sm:text-sm">
            AMBIENTE DE DEMONSTRAÇÃO — dados fictícios
          </aside>
        </>}
        {children}
      </body>
    </html>
  );
}
