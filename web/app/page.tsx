import Link from "next/link";
import { meta, subjects } from "@/lib/content";
import ProgressoResumo from "@/components/progresso-resumo";
import ProgressoSincronizacao from "@/components/progresso-sincronizacao";

export default function Home() {
  const treinosTotal = subjects.reduce((soma, subject) => soma + subject.units.length * 2, 0);
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight">ENEM Treino</h1>
      <p className="mt-2 text-neutral-500">
        {meta.units} unidades de estudo em {meta.subjects} matérias ·{" "}
        {meta.questions} questões do ENEM 2023 e 2024 com resolução comentada
      </p>
      <ProgressoResumo prefix="" total={treinosTotal} className="mt-1 block" />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <Link
              href={`/materia/${subject.id}`}
              className="flex h-full flex-col rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
            >
              <span className="text-lg font-semibold">{subject.name}</span>
              <span className="mt-1 text-sm text-neutral-500">{subject.area}</span>
              <span className="mt-4 text-sm text-neutral-600">
                {subject.units.length} unidades · {subject.units.length * 3} questões
              </span>
              <ProgressoResumo
                prefix={`${subject.id}-`}
                total={subject.units.length * 2}
                className="mt-2"
              />
            </Link>
          </li>
        ))}
      </ul>

      <ProgressoSincronizacao />
      <footer className="mt-6 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
        Questões do ENEM (INEP, CC BY-ND 3.0) extraídas da apostila “ENEM 2026 –
        Estudo por Questões” V3.
      </footer>
    </main>
  );
}
