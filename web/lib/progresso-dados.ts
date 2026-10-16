export const CODIGO_FORMATO = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export interface Tentativa {
  choice: string;
  correct: boolean;
  answeredAt: string;
}
export interface RespostaSalva extends Tentativa { anterior?: Tentativa }
export type Progresso = Record<string, RespostaSalva>;

export function respostaMaisRecente(progresso: Progresso, ids: string[]): RespostaSalva | undefined {
  return ids.map(id => progresso[id]).filter(Boolean)
    .sort((a, b) => Date.parse(b.answeredAt) - Date.parse(a.answeredAt))[0];
}

function tentativaValida(valor: unknown): valor is Tentativa {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const r = valor as Record<string, unknown>;
  return typeof r.choice === "string" && /^[A-E]$/.test(r.choice) &&
    typeof r.correct === "boolean" && typeof r.answeredAt === "string" &&
    Number.isFinite(Date.parse(r.answeredAt));
}
export function progressoValido(valor: unknown): valor is Progresso {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  return Object.entries(valor).every(([id, r]) =>
    /^[a-z0-9-]{1,100}$/.test(id) && tentativaValida(r) &&
    (!("anterior" in r) || r.anterior === undefined || tentativaValida(r.anterior)),
  );
}
export function mesclarProgresso(local: Progresso, remoto: Progresso): Progresso {
  const resultado = { ...local };
  for (const [id, resposta] of Object.entries(remoto)) {
    if (!resultado[id] || Date.parse(resposta.answeredAt) > Date.parse(resultado[id].answeredAt)) resultado[id] = resposta;
  }
  return resultado;
}
