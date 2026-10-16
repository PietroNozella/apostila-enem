import type { Metadata } from "next";
import Link from "next/link";
import { questoes } from "@/lib/questoes";
import SimuladoProva from "@/components/simulado-prova";

export const metadata: Metadata = {
  title: "Simulado",
  description:
    "Simulado reduzido com 45 questões do ENEM, escolha de idioma, cronômetro de 2h30 e gabarito no fim.",
};

export default function PaginaSimulado() {
  const catalogo = questoes;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="transition-colors hover:text-neutral-900">
          ← Início
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Simulado reduzido ENEM</h1>
      <SimuladoProva catalogo={catalogo} />
    </main>
  );
}
