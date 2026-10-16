"use client";

import { useEffect, useState } from "react";
import { resumoProgresso, type ResumoProgresso } from "@/lib/progresso";

interface ProgressoResumoProps {
  /** Prefixo do id de questão ("matematica-06-" por unidade, "matematica-" por matéria, "" = tudo). */
  prefix: string;
  total: number;
  className?: string;
}

/** Contador hidratado do localStorage; só aparece quando há progresso. */
export default function ProgressoResumo({ prefix, total, className = "" }: ProgressoResumoProps) {
  const [resumo, setResumo] = useState<ResumoProgresso | null>(null);

  useEffect(() => {
    setResumo(resumoProgresso(prefix));
  }, [prefix]);

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
