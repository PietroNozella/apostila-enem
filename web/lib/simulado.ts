/** Modo simulado: prova de 45 questões com prazo, guardada no localStorage. */

const STORAGE_KEY = "enem-treino:simulado";

export const QUESTOES_SIMULADO = 45;
export const DURACAO_MINUTOS = 150;

export interface QuestaoSimulado {
  id: string;
  image: string;
  exam: number;
  question: number;
  answer: string;
  materia: string;
  unidadeId: string;
  unidadeTitulo: string;
  /** Âncora do comentário na página da unidade; null para questões do banco de provas. */
  ancora: string | null;
  area: string;
  idioma: "ing" | "esp" | null;
  aliases?: string[];
  progressId?: string;
  aplicacao?: "regular" | "ppl";
}

export interface SimuladoSalvo {
  iniciadoEm: string;
  expiraEm: string;
  /** ids das questões, na ordem da prova */
  questoes: string[];
  respostas: Record<string, string>;
  finalizadoEm?: string;
  idioma?: "ing" | "esp";
}

export function lerSimulado(): SimuladoSalvo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.questoes) || parsed.questoes.length === 0 ||
      !parsed.questoes.every((id: unknown) => typeof id === "string") || new Set(parsed.questoes).size !== parsed.questoes.length ||
      !Number.isFinite(Date.parse(parsed.iniciadoEm)) || !Number.isFinite(Date.parse(parsed.expiraEm)) ||
      Date.parse(parsed.expiraEm) <= Date.parse(parsed.iniciadoEm) ||
      !parsed.respostas || typeof parsed.respostas !== "object" || Array.isArray(parsed.respostas) ||
      Object.entries(parsed.respostas).some(([id, letra]) => !parsed.questoes.includes(id) || typeof letra !== "string" || !/^[A-E]$/.test(letra)) ||
      (parsed.idioma !== undefined && parsed.idioma !== "ing" && parsed.idioma !== "esp") ||
      (parsed.finalizadoEm !== undefined && !Number.isFinite(Date.parse(parsed.finalizadoEm)))) return null;
    return parsed as SimuladoSalvo;
  } catch {
    return null;
  }
}

export function salvarSimulado(estado: SimuladoSalvo): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // storage bloqueado/cheio: a prova segue só em memória
  }
}

export function limparSimulado(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // idem
  }
}

export function iniciarSimulado(questoes: string[], idioma: "ing" | "esp" = "ing"): SimuladoSalvo {
  const agora = Date.now();
  return {
    iniciadoEm: new Date(agora).toISOString(),
    expiraEm: new Date(agora + DURACAO_MINUTOS * 60_000).toISOString(),
    questoes,
    respostas: {},
    idioma,
  };
}

export function restanteSegundos(estado: SimuladoSalvo): number {
  return Math.max(0, Math.floor((new Date(estado.expiraEm).getTime() - Date.now()) / 1000));
}

/** Intercala as quatro áreas e inclui apenas o idioma escolhido. */
export function sortearQuestoes(catalogo: QuestaoSimulado[], total = QUESTOES_SIMULADO, idioma: "ing" | "esp" = "ing"): string[] {
  const porMateria = new Map<string, string[]>();
  const vistos = new Set<string>();
  for (const questao of catalogo) {
    if ((questao.idioma && questao.idioma !== idioma) || vistos.has(questao.id)) continue;
    vistos.add(questao.id);
    const lista = porMateria.get(questao.area) ?? [];
    lista.push(questao.id);
    porMateria.set(questao.area, lista);
  }
  const pilhas = embaralhar([...porMateria.values()]).map((ids) => embaralhar(ids));
  const escolhidas: string[] = [];
  while (escolhidas.length < total) {
    let progrediu = false;
    for (const pilha of pilhas) {
      if (escolhidas.length === total) break;
      const id = pilha.pop();
      if (id === undefined) continue;
      escolhidas.push(id);
      progrediu = true;
    }
    if (!progrediu) break;
  }
  return embaralhar(escolhidas);
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function formatarTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
