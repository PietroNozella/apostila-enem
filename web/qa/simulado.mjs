/* QA do modo simulado: iniciar, responder, finalizar, retomar, expirar e abandonar. */
import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
const erros = [];

const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await desktop.newPage();
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") erros.push("console: " + m.text());
});
page.on("dialog", (d) => d.accept());

await page.goto(base + "/simulado", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(600);
await page.screenshot({ path: "qa/simulado-intro.png", fullPage: true });

await page.getByRole("button", { name: "Iniciar simulado" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "qa/simulado-prova.png" });

await page.getByRole("button", { name: "B", exact: true }).click();
await page.getByRole("button", { name: "Próxima →" }).click();
await page.getByRole("button", { name: "A", exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "qa/simulado-respondidas.png" });

await page.getByRole("button", { name: "Finalizar" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "qa/simulado-resultado.png" });
console.log("resultado visível:", (await page.getByText("gabarito abaixo").count()) > 0 ? "sim" : "NAO");

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(600);
console.log(
  "recarregar mantém resultado:",
  (await page.getByText("gabarito abaixo").count()) > 0 ? "sim" : "NAO"
);

// prova expirada fecha sozinha com o gabarito das respostas já salvas
await page.getByRole("button", { name: "Fazer novo simulado" }).click();
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("enem-treino:simulado"));
  s.expiraEm = new Date(Date.now() - 1000).toISOString();
  localStorage.setItem("enem-treino:simulado", JSON.stringify(s));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(600);
console.log(
  "prova expirada fecha como resultado:",
  (await page.getByText("gabarito abaixo").count()) > 0 ? "sim" : "NAO"
);

// abandonar volta à intro
await page.getByRole("button", { name: "Fazer novo simulado" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Abandonar" }).click();
await page.waitForTimeout(300);
console.log("abandonar volta à intro:", (await page.getByText("Como funciona").count()) > 0 ? "sim" : "NAO");

await desktop.close();

// mobile: prova em 390px com uma resposta marcada
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mobile.newPage();
mpage.on("pageerror", (e) => erros.push("m-pageerror: " + e.message));
await mpage.goto(base + "/simulado", { waitUntil: "load", timeout: 90000 });
await mpage.waitForTimeout(500);
await mpage.getByRole("button", { name: "Iniciar simulado" }).click();
await mpage.waitForTimeout(400);
await mpage.getByRole("button", { name: "B", exact: true }).click();
await mpage.waitForTimeout(200);
await mpage.screenshot({ path: "qa/simulado-mobile.png" });
await mobile.close();

console.log("erros JS:", erros.length ? erros : "nenhum");
await browser.close();
