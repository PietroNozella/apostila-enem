import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ProgressoStatus from "@/components/progresso-status";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ENEM Treino",
    template: "%s — ENEM Treino",
  },
  description: "Estude por unidades e treine com questões comentadas do ENEM.",
  openGraph: {
    title: "ENEM Treino",
    description: "Estude por unidades e treine com questões comentadas do ENEM 2023 e 2024.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<ProgressoStatus /></body>
    </html>
  );
}
