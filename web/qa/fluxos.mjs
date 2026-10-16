import "./carregar-ts.cjs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as aguardar } from "node:timers/promises";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { questoes } = require("../lib/questoes.ts");
const base = process.env.QA_BASE ?? "http://localhost:3100";
const servidor = process.env.QA_BASE ? null : spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3100"], { windowsHide: true, stdio: "pipe" });
let logs = "";
servidor?.stdout.on("data", c => { logs += c; });
servidor?.stderr.on("data", c => { logs += c; });
let browser;
let page;
try {
  let pronto = false;
  for (let i = 0; i < 150; i++) {
    try { pronto = (await fetch(base)).ok; } catch { /* servidor iniciando */ }
    if (pronto) break;
    await aguardar(200);
  }
  assert.ok(pronto, logs);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  page.on("dialog", d => d.accept());

  const q = questoes.find(q => q.subjectId === "matematica" && q.id.startsWith("enem2025-"));
  assert.ok(q, "Banco de 2025 publicado nas matérias");
  const errada = q.answer === "A" ? "B" : "A";
  let remoto = { [q.progressId]: { choice: errada, correct: false, answeredAt: "2026-01-01T12:00:00Z" } };
  let falhar = false;
  let envios = 0;
  await context.route("**/api/progresso/**", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { dados: remoto } });
    envios++;
    if (falhar) return route.fulfill({ status: 503, json: { erro: "indisponivel" } });
    remoto = route.request().postDataJSON().dados;
    return route.fulfill({ json: { ok: true, dados: remoto } });
  });

  await page.goto(base);
  await page.getByRole("textbox", { name: "Código de estudo" }).fill("ABCD-EFGH");
  await page.getByRole("button", { name: "Usar código", exact: true }).click();
  await page.getByText("Progresso sincronizado.", { exact: true }).waitFor();
  await page.getByRole("link", { name: /Matemática.*questões/ }).click();
  await page.getByLabel("Ano", { exact: true }).selectOption("2025");
  await page.getByLabel("Situação").selectOption("erradas");
  await page.getByRole("button", { name: "Refazer erradas (1)", exact: true }).click();
  assert.equal(await page.locator("#banco section").count(), 1);
  const treino = page.locator("#banco section").first();
  assert.ok(await treino.getByText("Tentativa anterior preservada", { exact: false }).isVisible());
  const antes = await page.evaluate(id => JSON.parse(localStorage.getItem("enem-treino:progresso"))[id], q.progressId);
  assert.equal(antes.choice, errada);
  await treino.getByRole("button", { name: q.answer, exact: true }).click();
  await treino.getByText("Você acertou", { exact: false }).waitFor();
  const depois = await page.evaluate(id => JSON.parse(localStorage.getItem("enem-treino:progresso"))[id], q.progressId);
  assert.equal(depois.choice, q.answer);
  assert.equal(depois.anterior.choice, errada);
  await treino.getByRole("button", { name: /Ampliar imagem/ }).click();
  await page.getByRole("dialog", { name: "Imagem ampliada" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Sair da revisão" }).click();
  await page.getByLabel("Situação").selectOption("corretas");
  assert.equal(await page.locator("#banco section").count(), 1);
  await page.reload();
  await page.getByLabel("Ano", { exact: true }).selectOption("2025");
  await page.getByLabel("Situação").selectOption("corretas");
  await page.getByText("Você acertou", { exact: false }).waitFor();
  await page.screenshot({ path: "qa/materia-revisao-desktop.png", fullPage: true });

  await page.goto(base);
  falhar = true;
  // Outra resposta deve permanecer local e sinalizar a falha de envio.
  await page.getByRole("link", { name: /Matemática.*questões/ }).click();
  const outro = page.locator("#banco section").first();
  await outro.getByRole("button", { name: "A", exact: true }).click();
  await page.goto(base);
  await page.getByText("Há respostas aguardando sincronização", { exact: false }).waitFor();
  falhar = false;
  await page.getByRole("button", { name: "Tentar sincronizar agora" }).click();
  await page.getByText("Progresso sincronizado.", { exact: true }).waitFor();
  assert.ok(envios >= 3);

  await page.goto(`${base}/simulado`);
  await page.getByLabel("Língua estrangeira").selectOption("esp");
  await page.getByRole("button", { name: "Iniciar simulado", exact: true }).click();
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem("enem-treino:simulado")));
  assert.equal(salvo.questoes.length, 45);
  assert.equal(salvo.idioma, "esp");
  assert.ok(salvo.questoes.every(id => !id.endsWith("-ing")));
  await page.getByRole("button", { name: "B", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "B", exact: true, pressed: true }).waitFor();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await page.getByText("gabarito abaixo", { exact: false }).waitFor();
  await page.reload();
  await page.getByText("gabarito abaixo", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Fazer novo simulado" }).click();
  await page.evaluate(() => {
    const estado = JSON.parse(localStorage.getItem("enem-treino:simulado"));
    estado.iniciadoEm = new Date(Date.now() - 20000).toISOString();
    estado.expiraEm = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem("enem-treino:simulado", JSON.stringify(estado));
  });
  await page.reload();
  await page.getByText("gabarito abaixo", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Fazer novo simulado" }).click();
  await page.getByRole("button", { name: "Abandonar" }).click();
  await page.getByRole("button", { name: "Iniciar simulado", exact: true }).waitFor();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mobile.newPage();
  mpage.on("pageerror", e => erros.push(e.message));
  await mpage.goto(`${base}/materia/biologia`);
  await mpage.getByLabel("Ano", { exact: true }).waitFor();
  assert.ok(await mpage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Sem rolagem horizontal no celular");
  await mpage.locator("#banco").screenshot({ path: "qa/materia-mobile.png" });
  await mpage.getByRole("button", { name: /Ampliar imagem/ }).first().click();
  await mpage.getByRole("button", { name: "Fechar imagem" }).click();
  await mobile.close();
  assert.deepEqual(erros, [], "Sem erros JavaScript");
  console.log("E2E aprovado: filtros, revisão, imagens, sincronização, retomada, expiração, idioma e mobile.");
} catch (erro) {
  if (page) {
    console.error("Página:", page.url());
    console.error((await page.locator("body").innerText()).slice(0, 3000));
    await page.screenshot({ path: "qa/falha-e2e.png", fullPage: true });
  }
  if (logs) console.error(logs.slice(-3000));
  throw erro;
} finally {
  await browser?.close();
  servidor?.kill();
}
