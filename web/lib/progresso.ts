/** Progresso sem login: cada resposta fica em localStorage; cópia opcional no Supabase por código. */

const STORAGE_KEY = "enem-treino:progresso";
const CODIGO_KEY = "enem-treino:codigo";

// 24 letras sem I/O + dígitos 2-9, para códigos sem ambiguidade visual
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CODIGO_FORMATO = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export interface RespostaSalva {
  choice: string;
  correct: boolean;
  answeredAt: string;
}

export type Progresso = Record<string, RespostaSalva>;

export function lerProgresso(): Progresso {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    return parsed as Progresso;
  } catch {
    return {};
  }
}

export function getResposta(questionId: string): RespostaSalva | null {
  return lerProgresso()[questionId] ?? null;
}

export function salvarResposta(questionId: string, resposta: RespostaSalva): void {
  if (typeof window === "undefined") return;
  try {
    const progresso = lerProgresso();
    progresso[questionId] = resposta;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progresso));
  } catch {
    // storage bloqueado/cheio: feedback segue funcionando só em memória
  }
  sincronizar();
}

export function removerResposta(questionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const progresso = lerProgresso();
    delete progresso[questionId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progresso));
  } catch {
    // idem
  }
  sincronizar();
}

export function aplicarProgresso(progresso: Progresso): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progresso));
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
  for (const [questionId, resposta] of Object.entries(lerProgresso())) {
    if (!questionId.startsWith(prefix)) continue;
    respondidas += 1;
    if (resposta.correct) corretas += 1;
  }
  return { respondidas, corretas };
}

export function getCodigo(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CODIGO_KEY);
}

export function salvarCodigo(codigo: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CODIGO_KEY, codigo);
  } catch {
    // idem
  }
}

export function gerarCodigo(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

/** Por questão, vence a resposta com o answeredAt mais recente. */
export function mesclarProgresso(local: Progresso, remoto: Progresso): Progresso {
  const mesclado: Progresso = { ...local };
  for (const [questionId, resposta] of Object.entries(remoto)) {
    const atual = mesclado[questionId];
    if (!atual || resposta.answeredAt > atual.answeredAt) {
      mesclado[questionId] = resposta;
    }
  }
  return mesclado;
}

export type BaixaResultado =
  | { ok: true; progresso: Progresso }
  | { ok: false; motivo: "formato" | "nao_encontrado" | "indisponivel" };

export async function baixarProgresso(codigo: string): Promise<BaixaResultado> {
  if (!CODIGO_FORMATO.test(codigo)) return { ok: false, motivo: "formato" };
  try {
    const res = await fetch(`/api/progresso/${encodeURIComponent(codigo)}`);
    if (res.status === 404) return { ok: false, motivo: "nao_encontrado" };
    if (!res.ok) return { ok: false, motivo: "indisponivel" };
    const body = (await res.json()) as { dados?: unknown };
    if (!body || typeof body !== "object" || body.dados === null || typeof body.dados !== "object") {
      return { ok: false, motivo: "indisponivel" };
    }
    return { ok: true, progresso: body.dados as Progresso };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}

/** Melhor esforço: sobe o progresso atual para o código conectado (silencioso). */
let sincronizando = false;

export function sincronizar(): void {
  const codigo = getCodigo();
  if (!codigo || sincronizando || !CODIGO_FORMATO.test(codigo)) return;
  sincronizando = true;
  fetch(`/api/progresso/${encodeURIComponent(codigo)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dados: lerProgresso() }),
  })
    .catch(() => undefined)
    .finally(() => {
      sincronizando = false;
    });
}
