"use client";

import { useState } from "react";
import { useCodigo } from "@/lib/use-progresso";
import {
  aplicarProgresso,
  baixarProgresso,
  gerarCodigo,
  lerProgresso,
  mesclarProgresso,
  salvarCodigo,
  sincronizar,
} from "@/lib/progresso";

const BOTAO =
  "rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:border-neutral-700 hover:bg-neutral-50";

export default function ProgressoSincronizacao() {
  const codigo = useCodigo();
  const [entrada, setEntrada] = useState("");
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function gerar() {
    const criado = gerarCodigo();
    salvarCodigo(criado);
    setErro(null);
    setAviso(null);
    sincronizar();
  }

  async function conectar() {
    const limpo = entrada.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const digitado =
      limpo.includes("-") || limpo.length !== 8 ? limpo : `${limpo.slice(0, 4)}-${limpo.slice(4)}`;
    setErro(null);
    setAviso(null);
    setConectando(true);
    const baixa = await baixarProgresso(digitado);
    if (!baixa.ok) {
      setConectando(false);
      setErro(
        baixa.motivo === "formato"
          ? "Use o formato XXXX-XXXX."
          : baixa.motivo === "nao_encontrado"
            ? "Código não encontrado."
            : "Servidor indisponível — tente novamente."
      );
      return;
    }
    const local = lerProgresso();
    let atualizadas = 0;
    for (const [questionId, resposta] of Object.entries(baixa.progresso)) {
      const atual = local[questionId];
      if (!atual || resposta.answeredAt > atual.answeredAt) atualizadas += 1;
    }
    aplicarProgresso(mesclarProgresso(local, baixa.progresso));
    salvarCodigo(digitado);
    setEntrada("");
    setConectando(false);
    setAviso(
      atualizadas > 0
        ? `Progresso conectado — ${atualizadas} resposta${atualizadas === 1 ? "" : "s"} atualizada${atualizadas === 1 ? "" : "s"}.`
        : "Progresso conectado — nada a atualizar."
    );
    sincronizar();
  }

  async function copiar() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setAviso("Código copiado.");
    } catch {
      setErro("Não foi possível copiar automaticamente; selecione o código acima.");
    }
  }

  return (
    <section className="mt-14 border-t border-neutral-200 pt-6">
      <h2 className="text-sm font-semibold">Progresso entre dispositivos</h2>
      <p className="mt-1 text-sm text-neutral-500">
        O progresso fica neste navegador. Gere um código para continuar nele em outro aparelho ou
        digite um código existente.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {codigo ? (
          <>
            <code className="rounded-lg bg-neutral-100 px-3 py-1.5 font-mono text-base font-semibold tracking-widest">
              {codigo}
            </code>
            <button type="button" onClick={copiar} className={BOTAO}>
              Copiar
            </button>
          </>
        ) : (
          <button type="button" onClick={gerar} className={BOTAO}>
            Gerar código de estudo
          </button>
        )}
      </div>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void conectar(); }}>
        <input
          aria-label="Código de estudo"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Conectar código existente (ex.: LUNA-2438)"
          className="min-w-56 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={conectando} className={BOTAO}>
          {conectando ? "Conectando..." : "Usar código"}
        </button>
      </form>
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      {aviso && <p className="mt-2 text-sm text-emerald-700">{aviso}</p>}
    </section>
  );
}
