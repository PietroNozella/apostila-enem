/** Progresso sem login: cada resposta fica em localStorage (um objeto por questão). */

const STORAGE_KEY = "enem-treino:progresso";

export interface RespostaSalva {
  choice: string;
  correct: boolean;
  answeredAt: string;
}

function readAll(): Record<string, RespostaSalva> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    return parsed as Record<string, RespostaSalva>;
  } catch {
    return {};
  }
}

export function getResposta(questionId: string): RespostaSalva | null {
  return readAll()[questionId] ?? null;
}

export function salvarResposta(questionId: string, resposta: RespostaSalva): void {
  if (typeof window === "undefined") return;
  try {
    const all = readAll();
    all[questionId] = resposta;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage bloqueado/cheio: feedback segue funcionando só em memória
  }
}

export function removerResposta(questionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = readAll();
    delete all[questionId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // idem
  }
}

export interface ResumoProgresso {
  respondidas: number;
  corretas: number;
}

/** Conta treinos respondidos/acertados por prefixo de id ("" = todos os treinos). */
export function resumoProgresso(prefix: string): ResumoProgresso {
  let respondidas = 0;
  let corretas = 0;
  for (const [questionId, resposta] of Object.entries(readAll())) {
    if (!questionId.startsWith(prefix)) continue;
    respondidas += 1;
    if (resposta.correct) corretas += 1;
  }
  return { respondidas, corretas };
}
