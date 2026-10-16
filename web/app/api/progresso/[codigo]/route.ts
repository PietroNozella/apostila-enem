import { connection } from "next/server";
import { CODIGO_FORMATO, mesclarProgresso, progressoValido, type Progresso } from "@/lib/progresso-dados";
import { questoes } from "@/lib/questoes";

const respostas = new Map(questoes.flatMap(q => q.aliases.map(id => [id, q.answer] as const)));
const headersSemCache = { "Cache-Control": "no-store" };
function json(dados: unknown, status = 200) { return Response.json(dados, { status, headers: headersSemCache }); }
function credenciais() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && chave ? { url: `${url}/rest/v1/progressos`, headers: { apikey: chave, Authorization: `Bearer ${chave}` } } : null;
}
type Linha = { dados: Progresso; atualizado_em: string | null };
async function ler(cred: NonNullable<ReturnType<typeof credenciais>>, codigo: string): Promise<Linha | null> {
  const res = await fetch(`${cred.url}?codigo=eq.${codigo}&select=dados,atualizado_em`, {
    headers: cred.headers, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("leitura");
  const linhas = await res.json();
  if (!Array.isArray(linhas)) throw new Error("payload");
  if (linhas.length && !progressoValido(linhas[0].dados)) throw new Error("payload");
  return linhas[0] ?? null;
}
export async function GET(_request: Request, context: RouteContext<'/api/progresso/[codigo]'>) {
  await connection();
  const { codigo } = await context.params;
  if (!CODIGO_FORMATO.test(codigo)) return json({ erro: "formato" }, 400);
  const cred = credenciais();
  if (!cred) return json({ erro: "configuracao" }, 503);
  try {
    const linha = await ler(cred, codigo);
    return linha ? json({ dados: linha.dados }) : json({ erro: "nao_encontrado" }, 404);
  } catch { return json({ erro: "indisponivel" }, 502); }
}
export async function PUT(request: Request, context: RouteContext<'/api/progresso/[codigo]'>) {
  const { codigo } = await context.params;
  if (!CODIGO_FORMATO.test(codigo)) return json({ erro: "formato" }, 400);
  const cred = credenciais();
  if (!cred) return json({ erro: "configuracao" }, 503);
  let dados: Progresso;
  try {
    const raw = await request.text();
    if (raw.length > 1_000_000) return json({ erro: "tamanho" }, 413);
    const body = JSON.parse(raw);
    if (!progressoValido(body?.dados) || Object.keys(body.dados).some(id => !respostas.has(id))) return json({ erro: "payload" }, 400);
    dados = Object.fromEntries(Object.entries(body.dados as Progresso).map(([id, r]) => [id, {
      ...r, correct: r.choice === respostas.get(id),
      ...(r.anterior ? { anterior: { ...r.anterior, correct: r.anterior.choice === respostas.get(id) } } : {}),
    }]));
  } catch { return json({ erro: "payload" }, 400); }
  try {
    // Compare-and-swap evita que dois aparelhos sobrescrevam as respostas um do outro.
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const linha = await ler(cred, codigo);
      const mesclado = mesclarProgresso(dados, linha?.dados ?? {});
      const atualizado = new Date(Math.max(Date.now(), Date.parse(linha?.atualizado_em ?? "") + 1 || 0)).toISOString();
      const condicao = linha?.atualizado_em ? `eq.${encodeURIComponent(linha.atualizado_em)}` : "is.null";
      const res = await fetch(linha ? `${cred.url}?codigo=eq.${codigo}&atualizado_em=${condicao}` : cred.url, {
        method: linha ? "PATCH" : "POST",
        headers: { ...cred.headers, "Content-Type": "application/json", Prefer: `${linha ? "" : "resolution=ignore-duplicates,"}return=representation` },
        body: JSON.stringify({ codigo, dados: mesclado, atualizado_em: atualizado }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error("escrita");
      const gravadas = await res.json();
      if (Array.isArray(gravadas) && gravadas.length === 1) return json({ ok: true, dados: mesclado });
    }
    return json({ erro: "conflito" }, 409);
  } catch { return json({ erro: "indisponivel" }, 502); }
}
