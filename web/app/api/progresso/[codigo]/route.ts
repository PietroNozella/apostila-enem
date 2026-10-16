import { connection } from "next/server";

/* Progresso entre dispositivos: GET busca a cópia, PUT sobe a atual.
   Segredo (service key) fica só no servidor. */

const CODIGO_FORMATO = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const QUESTAO_FORMATO = /^[a-z]+-\d{2}-treino[12]$/;

function credenciais(): { url: string; chave: string } | null {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && chave ? { url, chave } : null;
}

/** Mapa { "matematica-06-treino1": { choice, correct, answeredAt }, ... } consistente. */
function validarDados(dados: unknown): boolean {
  if (dados === null || typeof dados !== "object") return false;
  for (const [questionId, resposta] of Object.entries(dados as Record<string, unknown>)) {
    if (!QUESTAO_FORMATO.test(questionId)) return false;
    if (resposta === null || typeof resposta !== "object") return false;
    const r = resposta as Record<string, unknown>;
    if (typeof r.choice !== "string" || !/^[A-E]$/.test(r.choice)) return false;
    if (typeof r.correct !== "boolean") return false;
    if (typeof r.answeredAt !== "string" || Number.isNaN(Date.parse(r.answeredAt))) return false;
  }
  return true;
}

export async function GET(_request: Request, context: RouteContext<'/api/progresso/[codigo]'>) {
  await connection();
  const { codigo } = await context.params;
  if (!CODIGO_FORMATO.test(codigo)) {
    return Response.json({ erro: "formato" }, { status: 400 });
  }
  const cred = credenciais();
  if (!cred) return Response.json({ erro: "configuracao" }, { status: 500 });

  const res = await fetch(
    `${cred.url}/rest/v1/progressos?codigo=eq.${encodeURIComponent(codigo)}&select=codigo,dados,atualizado_em`,
    {
      headers: { apikey: cred.chave, Authorization: `Bearer ${cred.chave}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return Response.json({ erro: "indisponivel" }, { status: 502 });
  const linhas = (await res.json()) as Array<{ dados: unknown }>;
  if (!Array.isArray(linhas) || linhas.length === 0) {
    return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  }
  return Response.json({ dados: linhas[0].dados });
}

export async function PUT(request: Request, context: RouteContext<'/api/progresso/[codigo]'>) {
  const { codigo } = await context.params;
  if (!CODIGO_FORMATO.test(codigo)) {
    return Response.json({ erro: "formato" }, { status: 400 });
  }
  const cred = credenciais();
  if (!cred) return Response.json({ erro: "configuracao" }, { status: 500 });

  let body: { dados?: unknown };
  try {
    body = (await request.json()) as { dados?: unknown };
  } catch {
    return Response.json({ erro: "payload" }, { status: 400 });
  }
  if (!validarDados(body.dados)) return Response.json({ erro: "payload" }, { status: 400 });

  const res = await fetch(`${cred.url}/rest/v1/progressos`, {
    method: "POST",
    headers: {
      apikey: cred.chave,
      Authorization: `Bearer ${cred.chave}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      codigo,
      dados: body.dados,
      atualizado_em: new Date().toISOString(),
    }),
  });
  if (!res.ok) return Response.json({ erro: "indisponivel" }, { status: 502 });
  return Response.json({ ok: true });
}
