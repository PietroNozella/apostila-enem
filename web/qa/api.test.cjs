/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS do node:test. */
require("./carregar-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const progresso = require("../lib/progresso-dados.ts");
const catalogo = require("../lib/questoes.ts");

function criarApi(fetch) {
  const contexto = { exports: {}, process: { env: { SUPABASE_URL: "https://exemplo.invalid", SUPABASE_SERVICE_ROLE_KEY: "somente-teste" } }, Response, AbortSignal, fetch,
    require: id => id === "next/server" ? { connection: async () => {} } : id.endsWith("progresso-dados") ? progresso : catalogo };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("app/api/progresso/[codigo]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, contexto);
  return contexto.exports;
}
const ctx = { params: Promise.resolve({ codigo: "ABCD-EFGH" }) };
const req = dados => new Request("https://app.invalid/api/progresso/ABCD-EFGH", { method: "PUT", body: JSON.stringify({ dados }) });

test("API rejeita payload nulo, arrays e identidades desconhecidas", async () => {
  const api = criarApi(() => { throw new Error("Não deveria acessar banco"); });
  for (const dados of [null, [], { desconhecida: { choice: "A", correct: true, answeredAt: new Date().toISOString() } }]) {
    assert.equal((await api.PUT(req(dados), ctx)).status, 400);
  }
});

test("API refaz merge quando outro dispositivo vence a escrita concorrente", async () => {
  const [q1, q2] = catalogo.questoes;
  let linha = { dados: {}, atualizado_em: "2026-01-01T00:00:00Z" };
  let escritas = 0;
  const api = criarApi(async (_url, opcoes) => {
    if (!opcoes.method) return Response.json([linha]);
    escritas++;
    if (escritas === 1) {
      linha = { dados: { [q2.progressId]: { choice: q2.answer, correct: true, answeredAt: "2026-02-01T00:00:00Z" } }, atualizado_em: "2026-02-01T00:00:00Z" };
      return Response.json([]);
    }
    linha = JSON.parse(opcoes.body);
    return Response.json([linha]);
  });
  const res = await api.PUT(req({ [q1.progressId]: { choice: q1.answer, correct: false, answeredAt: "2026-03-01T00:00:00Z" } }), ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(Object.keys(body.dados).length, 2);
  assert.equal(body.dados[q1.progressId].correct, true);
  assert.equal(escritas, 2);
});
