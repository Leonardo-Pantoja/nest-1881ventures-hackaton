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
  title: "AntesDeGastar — Copiloto de Decisiones Pre-Compra",
  description:
    "Toma mejores decisiones con tu dinero antes de gastar, no después. Evalúa cualquier compra en segundos sin comprometer tu liquidez ni tus metas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF8F5] text-slate-900 selection:bg-slate-900 selection:text-[#FAF8F5]">
        {children}
      </body>
    </html>
  );
}
