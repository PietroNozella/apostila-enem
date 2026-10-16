import { CODIGO_FORMATO, mesclarProgresso, progressoValido, type Progresso, type RespostaSalva } from "./progresso-dados";
export { CODIGO_FORMATO, mesclarProgresso, type Progresso, type RespostaSalva } from "./progresso-dados";

const STORAGE_KEY = "enem-treino:progresso";
const CODIGO_KEY = "enem-treino:codigo";
const PENDENTE_KEY = "enem-treino:pendente";
const EVENTO = "enem-treino:atualizado";
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let memoria = "{}";
let codigoMemoria: string | null = null;
let armazenamentoFalhou = false;
let enviando = false;
let status = "local";
const memoriaChaves = new Map<string, string>();

function notificar() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}
function lerChave(chave: string, fallback: string | null): string | null {
  if (armazenamentoFalhou) return memoriaChaves.get(chave) ?? fallback;
  try {
    const valor = window.localStorage.getItem(chave);
    if (valor !== null) memoriaChaves.set(chave, valor);
    return valor ?? fallback;
  } catch { return memoriaChaves.get(chave) ?? fallback; }
}
function gravarChave(chave: string, valor: string) {
  memoriaChaves.set(chave, valor);
  try { window.localStorage.setItem(chave, valor); } catch { armazenamentoFalhou = true; }
}
export function snapshotProgresso(): string {
  if (typeof window === "undefined") return "{}";
  return lerChave(STORAGE_KEY, memoria) ?? "{}";
}
export function lerProgresso(): Progresso {
  try { const valor: unknown = JSON.parse(snapshotProgresso()); return progressoValido(valor) ? valor : {}; }
  catch { return {}; }
}
export function getResposta(id: string): RespostaSalva | null { return lerProgresso()[id] ?? null; }
export function aplicarProgresso(progresso: Progresso): void {
  if (typeof window === "undefined") return;
  memoria = JSON.stringify(progresso);
  gravarChave(STORAGE_KEY, memoria);
  notificar();
}
export function salvarResposta(id: string, resposta: RespostaSalva): void {
  const progresso = lerProgresso();
  const anterior = progresso[id];
  progresso[id] = anterior ? { ...resposta, anterior: {
    choice: anterior.choice, correct: anterior.correct, answeredAt: anterior.answeredAt,
  } } : resposta;
  aplicarProgresso(progresso);
  sincronizar();
}
export interface ResumoProgresso { respondidas: number; corretas: number }
export function resumoProgresso(prefix: string): ResumoProgresso {
  const respostas = Object.entries(lerProgresso()).filter(([id]) => id.startsWith(prefix));
  return { respondidas: respostas.length, corretas: respostas.filter(([, r]) => r.correct).length };
}
export function getCodigo(): string | null {
  return typeof window === "undefined" ? null : lerChave(CODIGO_KEY, codigoMemoria);
}
export function salvarCodigo(codigo: string): void {
  codigoMemoria = codigo;
  gravarChave(CODIGO_KEY, codigo);
  notificar();
}
export function gerarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, b => ALFABETO[b % ALFABETO.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}
export type BaixaResultado = { ok: true; progresso: Progresso } |
  { ok: false; motivo: "formato" | "nao_encontrado" | "indisponivel" };
export async function baixarProgresso(codigo: string): Promise<BaixaResultado> {
  if (!CODIGO_FORMATO.test(codigo)) return { ok: false, motivo: "formato" };
  try {
    const res = await fetch(`/api/progresso/${codigo}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (res.status === 404) return { ok: false, motivo: "nao_encontrado" };
    if (!res.ok) return { ok: false, motivo: "indisponivel" };
    const body = await res.json();
    return progressoValido(body?.dados) ? { ok: true, progresso: body.dados } : { ok: false, motivo: "indisponivel" };
  } catch { return { ok: false, motivo: "indisponivel" }; }
}
export function snapshotSincronizacao(): string {
  if (armazenamentoFalhou) return "memoria";
  if (!getCodigo()) return "local";
  return status === "enviando" ? status : lerChave(PENDENTE_KEY, "0") === "1" ? "pendente" : "salvo";
}
/** A pendência só é removida depois de confirmar a versão mais recente. */
export function sincronizar(): void {
  if (typeof window === "undefined" || !CODIGO_FORMATO.test(getCodigo() ?? "")) return;
  gravarChave(PENDENTE_KEY, "1");
  notificar();
  void enviarPendentes();
}
async function enviarPendentes() {
  if (enviando || !getCodigo() || lerChave(PENDENTE_KEY, "0") !== "1") return;
  enviando = true;
  status = "enviando";
  notificar();
  try {
    while (lerChave(PENDENTE_KEY, "0") === "1") {
      const codigo = getCodigo();
      const dados = snapshotProgresso();
      const res = await fetch(`/api/progresso/${codigo}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: JSON.parse(dados) }), signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error("envio");
      const body = await res.json();
      if (codigo === getCodigo() && progressoValido(body?.dados)) {
        aplicarProgresso(mesclarProgresso(lerProgresso(), body.dados));
      }
      const confirmado = progressoValido(body?.dados) ? JSON.stringify(mesclarProgresso(JSON.parse(dados), body.dados)) : dados;
      if (codigo === getCodigo() && confirmado === snapshotProgresso()) gravarChave(PENDENTE_KEY, "0");
    }
    status = "salvo";
  } catch { status = "pendente"; }
  finally { enviando = false; notificar(); }
}
export function observarProgresso(callback: () => void): () => void {
  const atualizar = () => callback();
  const retomar = () => { void enviarPendentes(); };
  const visivel = () => { if (document.visibilityState === "visible") retomar(); };
  window.addEventListener(EVENTO, atualizar);
  window.addEventListener("storage", atualizar);
  window.addEventListener("online", retomar);
  window.addEventListener("focus", retomar);
  document.addEventListener("visibilitychange", visivel);
  const timer = window.setInterval(retomar, 30_000);
  if (getCodigo() && lerChave(PENDENTE_KEY, null) === null) gravarChave(PENDENTE_KEY, "1");
  retomar();
  return () => {
    window.removeEventListener(EVENTO, atualizar);
    window.removeEventListener("storage", atualizar);
    window.removeEventListener("online", retomar);
    window.removeEventListener("focus", retomar);
    document.removeEventListener("visibilitychange", visivel);
    window.clearInterval(timer);
  };
}
