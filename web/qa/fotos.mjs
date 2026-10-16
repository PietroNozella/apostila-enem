/* QA visual: captura as superfícies principais em desktop e mobile (arquivo ignorado pelo git). */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://localhost:3000";
mkdirSync("qa", { recursive: true });

const browser = await chromium.launch();

const capturas = [
  ["home-desktop", "/", { width: 1280, height: 900 }],
  ["home-mobile", "/", { width: 390, height: 844 }],
  ["materia-mobile", "/materia/portugues", { width: 390, height: 844 }],
  ["unidade-desktop", "/unidade/matematica-06", { width: 1280, height: 900 }],
  ["unidade-mobile", "/unidade/matematica-06", { width: 390, height: 844 }],
];

for (const [nome, pagina, viewport] of capturas) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(base + pagina, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `qa/${nome}.png`, fullPage: true });
  await page.close();
  console.log("ok:", nome);
}

// fluxo do treino: responde a primeira questão e captura o feedback
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base + "/unidade/portugues-01", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(800);
const secaoTreino = page.locator("#treino-1");
await secaoTreino.scrollIntoViewIfNeeded();
await secaoTreino.getByRole("button", { name: "A", exact: true }).click();
await page.waitForTimeout(400);
await secaoTreino.screenshot({ path: "qa/treino-feedback.png" });
console.log("ok: treino-feedback");

await browser.close();
