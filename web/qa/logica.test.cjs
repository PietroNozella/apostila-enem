/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS do node:test. */
require("./carregar-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { questoes } = require("../lib/questoes.ts");
const simulado = require("../lib/simulado.ts");
const dados = require("../lib/progresso-dados.ts");

test("sorteio distribui quatro áreas, não duplica e respeita o idioma", () => {
  for (const idioma of ["ing", "esp"]) {
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const ids = simulado.sortearQuestoes([...questoes, questoes[0]], 45, idioma);
      assert.equal(ids.length, 45);
      assert.equal(new Set(ids).size, 45);
      const contagens = new Map();
      for (const id of ids) {
        const q = questoes.find(q => q.id === id);
        assert.ok(q);
        assert.ok(!q.idioma || q.idioma === idioma);
        contagens.set(q.area, (contagens.get(q.area) ?? 0) + 1);
      }
      assert.equal(contagens.size, 4);
      assert.ok(Math.max(...contagens.values()) - Math.min(...contagens.values()) <= 1);
    }
  }
});

test("questões da apostila e banco usam a mesma identidade e mantêm o progresso antigo", () => {
  assert.equal(new Set(questoes.map(q => q.id)).size, questoes.length);
  const q = questoes.find(q => q.id === "enem2024-178");
  assert.ok(q);
  assert.equal(q.progressId, "matematica-01-resolvida");
  assert.ok(q.commentary.length > 0);
  for (const q of questoes) assert.ok(fs.existsSync(`public${q.image}`), q.image);
});

test("dados inválidos não entram no progresso; merge compara datas reais", () => {
  assert.equal(dados.progressoValido([]), false);
  assert.equal(dados.progressoValido({ q: { choice: "Z", correct: true, answeredAt: "hoje" } }), false);
  const a = { choice: "A", correct: false, answeredAt: "2026-10-16T12:00:00-03:00" };
  const b = { choice: "B", correct: true, answeredAt: "2026-10-16T14:00:00Z" };
  assert.equal(dados.mesclarProgresso({ q: a }, { q: b }).q.choice, "A");
});

function progressoIsolado(fetch) {
  const storage = new Map([["enem-treino:codigo", "ABCD-EFGH"]]);
  const window = new EventTarget();
  window.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const contexto = { exports: {}, require: () => dados, window, Event, AbortSignal, fetch };
  const codigo = ts.transpileModule(fs.readFileSync("lib/progresso.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(codigo, contexto);
  return { p: contexto.exports, storage };
}
const turno = () => new Promise(resolve => setImmediate(resolve));
const resposta = (choice = "A") => ({ choice, correct: false, answeredAt: new Date().toISOString() });

test("resposta feita durante um envio é enviada em seguida", async () => {
  const envios = [];
  let concluir;
  const { p, storage } = progressoIsolado((_url, opcoes) => {
    envios.push(JSON.parse(opcoes.body).dados);
    return new Promise(resolve => { concluir = () => resolve({ ok: true, json: async () => ({ ok: true }) }); });
  });
  p.salvarResposta("matematica-01-treino1", resposta());
  p.salvarResposta("matematica-01-treino2", resposta("B"));
  assert.equal(envios.length, 1);
  concluir(); await turno();
  assert.equal(envios.length, 2);
  assert.equal(Object.keys(envios[1]).length, 2);
  concluir(); await turno();
  assert.equal(storage.get("enem-treino:pendente"), "0");
});

test("falha HTTP mantém pendência e novo envio recupera todas as respostas", async () => {
  let falhar = true;
  const { p, storage } = progressoIsolado(async () => ({ ok: !falhar, json: async () => ({ ok: true }) }));
  p.salvarResposta("matematica-01-treino1", resposta()); await turno();
  assert.equal(storage.get("enem-treino:pendente"), "1");
  assert.equal(p.snapshotSincronizacao(), "pendente");
  falhar = false;
  p.sincronizar(); await turno();
  assert.equal(storage.get("enem-treino:pendente"), "0");
  p.salvarResposta("matematica-01-treino1", resposta("B")); await turno();
  assert.equal(p.getResposta("matematica-01-treino1").anterior.choice, "A");
});

test("simulado rejeita armazenamento corrompido", () => {
  global.window = { localStorage: { getItem: () => JSON.stringify({ questoes: ["q"], expiraEm: "inválido" }) } };
  assert.equal(simulado.lerSimulado(), null);
  delete global.window;
});
