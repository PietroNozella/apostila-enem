import type { Metadata } from "next";
import Link from "next/link";
import { subjects } from "@/lib/content";
import { banco } from "@/lib/banco";
import SimuladoProva from "@/components/simulado-prova";
import type { QuestaoSimulado } from "@/lib/simulado";

export const metadata: Metadata = {
  title: "Simulado",
  description:
    "45 questões sorteadas da apostila e das provas oficiais do ENEM, cronômetro de 2h30 e gabarito no fim, no formato da prova.",
};

export default function PaginaSimulado() {
  const catalogo: QuestaoSimulado[] = [];
  for (const subject of subjects) {
    for (const unit of subject.units) {
      catalogo.push(
        {
          id: `${unit.id}-resolvida`,
          image: `/${unit.resolved.images[0]}`,
          exam: unit.resolved.exam,
          question: unit.resolved.question,
          answer: unit.resolved.answer,
          materia: subject.name,
          unidadeId: unit.id,
          unidadeTitulo: unit.title,
          ancora: "#resolvida",
        },
        ...unit.training.map((training) => ({
          id: `${unit.id}-treino${training.n}`,
          image: `/${training.images[0]}`,
          exam: training.exam,
          question: training.question,
          answer: training.answer,
          materia: subject.name,
          unidadeId: unit.id,
          unidadeTitulo: unit.title,
          ancora: `#treino-${training.n}`,
        })),
      );
    }
  }
  for (const questao of banco) {
    catalogo.push({
      id: questao.id,
      image: `/${questao.image}`,
      exam: questao.exam,
      question: questao.question,
      answer: questao.answer,
      materia: questao.materia,
      unidadeId: "",
      unidadeTitulo: "",
      ancora: null,
    });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="transition-colors hover:text-neutral-900">
          ← Início
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Simulado ENEM</h1>
      <SimuladoProva catalogo={catalogo} />
    </main>
  );
}
