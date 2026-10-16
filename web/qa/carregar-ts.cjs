/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS do node:test. */
// Usa o compilador já instalado; não adiciona um runner à aplicação.
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (mod, filename) => {
  const resultado = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  mod._compile(resultado.outputText, filename);
};

// No app, o bundler prioriza .ts sobre o JSON de mesmo nome.
const jsonLoader = require.extensions[".json"];
delete require.extensions[".json"];
require.extensions[".json"] = jsonLoader;
