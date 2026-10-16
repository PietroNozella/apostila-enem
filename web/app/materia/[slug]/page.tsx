import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubject, subjects } from "@/lib/content";
import ProgressoResumo from "@/components/progresso-resumo";

export function generateStaticParams() {
  return subjects.map((subject) => ({ slug: subject.id }));
}

export default async function Page(props: PageProps<'/materia/[slug]'>) {
  const { slug } = await props.params;
  const subject = getSubject(slug);
  if (!subject) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
      >
        ← Matérias
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{subject.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {subject.area} · {subject.units.length} unidades ·{" "}
        {subject.units.length * 3} questões
      </p>

      <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
        {subject.units.map((unit) => (
          <li key={unit.id}>
            <Link
              href={`/unidade/${unit.id}`}
              className="flex items-center gap-4 py-4 pr-2 transition-colors hover:bg-neutral-50"
            >
              <span className="min-w-9 rounded-lg bg-neutral-100 px-2 py-1 text-center text-sm font-semibold">
                {unit.number}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{unit.title}</span>
                <span className="block text-sm text-neutral-500">
                  Explicação + 3 questões comentadas
                </span>
              </span>
              <ProgressoResumo prefix={`${unit.id}-treino`} total={2} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
