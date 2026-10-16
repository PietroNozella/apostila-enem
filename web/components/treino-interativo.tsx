"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { getResposta, removerResposta, salvarResposta } from "@/lib/progresso";

const LETTERS = ["A", "B", "C", "D", "E"];

interface TreinoInterativoProps {
  questionId: string;
  heading: string;
  exam: number;
  question: number;
  image: string;
  answer: string;
  paragraphs: string[];
  id?: string;
}

export default function TreinoInterativo({
  questionId,
  heading,
  exam,
  question,
  image,
  answer,
  paragraphs,
  id,
}: TreinoInterativoProps) {
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    const salva = getResposta(questionId);
    if (salva) setChoice(salva.choice);
  }, [questionId]);

  const answered = choice !== null;

  function responder(letra: string) {
    if (answered) return;
    salvarResposta(questionId, {
      choice: letra,
      correct: letra === answer,
      answeredAt: new Date().toISOString(),
    });
    setChoice(letra);
  }

  function refazer() {
    removerResposta(questionId);
    setChoice(null);
  }

  function classeDoBotao(letra: string): string {
    if (!answered) {
      return "border-neutral-300 text-neutral-900 hover:border-neutral-700 hover:bg-neutral-50";
    }
    if (letra === answer) return "border-emerald-600 bg-emerald-600 text-white";
    if (letra === choice) return "border-red-300 bg-red-50 text-red-700";
    return "border-neutral-200 text-neutral-400";
  }

  return (
    <section id={id} className="mt-12">
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

      <div className="mt-6 flex flex-wrap gap-3">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => responder(letter)}
            disabled={answered}
            className={`min-w-14 rounded-lg border px-4 py-2.5 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${classeDoBotao(letter)}`}
          >
            {letter}
          </button>
        ))}
      </div>

      {answered && (
        <div className="revelar">
          {choice === answer ? (
            <p className="mt-6 inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
              Você acertou — gabarito <strong>{answer}</strong>.
            </p>
          ) : (
            <p className="mt-6 inline-block rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800">
              Você marcou {choice} — gabarito <strong>{answer}</strong>.
            </p>
          )}
          <div className="mt-4 space-y-4 leading-relaxed">
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <button
            type="button"
            onClick={refazer}
            className="mt-4 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Refazer questão
          </button>
        </div>
      )}
    </section>
  );
}
