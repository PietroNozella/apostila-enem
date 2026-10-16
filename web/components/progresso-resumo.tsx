"use client";

import { useProgresso } from "@/lib/use-progresso";
import { respostaMaisRecente } from "@/lib/progresso-dados";

interface ProgressoResumoProps {
  /** Prefixo do id de questão ("matematica-06-" por unidade, "matematica-" por matéria, "" = tudo). */
  prefix: string;
  total: number;
  className?: string;
  grupos?: string[][];
}

/** Contador hidratado do localStorage; só aparece quando há progresso. */
export default function ProgressoResumo({ prefix, total, className = "", grupos }: ProgressoResumoProps) {
  const progresso = useProgresso();
  const respostas = grupos
    ? grupos.map(ids => respostaMaisRecente(progresso, ids)).filter(r => r !== undefined)
    : Object.entries(progresso).filter(([id]) => id.startsWith(prefix)).map(([, r]) => r);
  const resumo = { respondidas: respostas.length, corretas: respostas.filter(r => r.correct).length };

  if (!resumo || resumo.respondidas === 0) return null;

  const completo = resumo.respondidas >= total;
  const acertos = resumo.corretas === 1 ? "1 acerto" : `${resumo.corretas} acertos`;

  return (
    <span
      className={`revelar ml-auto shrink-0 text-sm ${
        completo ? "font-medium text-emerald-700" : "text-neutral-500"
      } ${className}`}
    >
      {resumo.respondidas}/{total} treinos · {acertos}
    </span>
  );
}
