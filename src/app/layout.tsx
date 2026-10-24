import type { Metadata } from "next";
import { Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import { FinancialProvider } from "@/context/FinancialContext";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AntesDeGastar — Copiloto Gamificado Pre-Compra",
  description:
    "Cuida tu planta financiera, gana XP y decide tus compras en segundos con total paz mental.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${fredoka.variable} ${plusJakartaSans.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF8F5] text-slate-900 font-sans selection:bg-emerald-600 selection:text-white">
        <FinancialProvider>{children}</FinancialProvider>
      </body>
    </html>
  );
}
