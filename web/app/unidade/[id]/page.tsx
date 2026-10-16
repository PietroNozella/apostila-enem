/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUnit, paragraphs, subjects } from "@/lib/content";
import TreinoInterativo from "@/components/treino-interativo";

export function generateStaticParams() {
  return subjects.flatMap((subject) => subject.units.map((unit) => ({ id: unit.id })));
}

function QuestionSection({
  heading,
  exam,
  question,
  image,
  answer,
  commentary,
}: {
  heading: string;
  exam: number;
  question: number;
  image: string;
  answer: string;
  commentary: string;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">
        {heading}{" "}
        <span className="text-sm font-normal text-neutral-500">
          ENEM {exam} · questão {question}
        </span>
      </h2>
      <img
        src={image}
        alt={`Enunciado da questão ${question} do ENEM ${exam}`}
        loading="lazy"
        className="mt-4 w-full rounded-xl border border-neutral-200"
      />
      <p className="mt-4 inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
        Gabarito: <strong>{answer}</strong>
      </p>
      <div className="mt-4 space-y-4 leading-relaxed">
        {paragraphs(commentary).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

export default async function Page(props: PageProps<'/unidade/[id]'>) {
  const { id } = await props.params;
  const found = getUnit(id);
  if (!found) notFound();
  const { subject, unit } = found;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <Link
        href={`/materia/${subject.id}`}
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
      >
        ← {subject.name}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{unit.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {subject.name} · Unidade {unit.number} · Explicação + 3 questões
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Explicação da unidade</h2>
        <div className="mt-3 space-y-4 leading-relaxed">
          {paragraphs(unit.explanation).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </section>

      <QuestionSection
        heading="Questão resolvida"
        exam={unit.resolved.exam}
        question={unit.resolved.question}
        image={`/${unit.resolved.images[0]}`}
        answer={unit.resolved.answer}
        commentary={unit.resolved.commentary}
      />

      {unit.training.map((training) => (
        <TreinoInterativo
          key={training.n}
          questionId={`${unit.id}-treino${training.n}`}
          heading={`Treino ${training.n}`}
          exam={training.exam}
          question={training.question}
          image={`/${training.images[0]}`}
          answer={training.answer}
          paragraphs={paragraphs(training.commentary)}
        />
      ))}
    </main>
  );
}
