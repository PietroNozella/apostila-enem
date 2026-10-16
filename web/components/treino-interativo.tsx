"use client";

import { useState } from "react";
import { salvarResposta } from "@/lib/progresso";
import { useProgresso } from "@/lib/use-progresso";
import ImagemQuestao from "./imagem-questao";
import { respostaMaisRecente } from "@/lib/progresso-dados";

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
  revisao?: boolean;
  aliases?: string[];
  sourceUrl?: string;
  onAnswered?: () => void;
  aplicacao?: "regular" | "ppl";
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
  revisao = false,
  sourceUrl,
  aliases = [questionId],
  onAnswered,
  aplicacao = "regular",
}: TreinoInterativoProps) {
  const progresso = useProgresso();
  const salva = respostaMaisRecente(progresso, aliases);
  const [refazendo, setRefazendo] = useState(revisao);
  const choice = refazendo ? null : salva?.choice ?? null;

  const answered = choice !== null;

  function responder(letra: string) {
    if (answered) return;
    onAnswered?.();
    salvarResposta(questionId, {
      choice: letra,
      correct: letra === answer,
      answeredAt: new Date().toISOString(),
    });
    setRefazendo(false);
  }

  function refazer() {
    setRefazendo(true);
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
          ENEM {exam}{aplicacao === "ppl" ? " · Reaplicação/PPL" : ""} · questão {question}
        </span>
      </h2>
      <ImagemQuestao src={image} alt={`Enunciado da questão ${question} do ENEM ${exam}`} />
      {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">Prova oficial (PDF)</a>}
      {refazendo && salva && <p className="mt-3 text-sm text-neutral-500">Tentativa anterior preservada. Ela será atualizada quando você responder novamente.</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => responder(letter)}
            disabled={answered}
            aria-pressed={letter === choice}
            className={`min-w-14 rounded-lg border px-4 py-2.5 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${classeDoBotao(letter)}`}
          >
            {letter}
          </button>
        ))}
      </div>

      {answered && (
        <div className="revelar" aria-live="polite">
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
            {paragraphs.length === 0 && <p className="text-sm text-neutral-500">Sem resolução comentada. Gabarito oficial do INEP.</p>}
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
