"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type QuestaoSimulado,
  type SimuladoSalvo,
  DURACAO_MINUTOS,
  QUESTOES_SIMULADO,
  formatarTempo,
  iniciarSimulado,
  limparSimulado,
  lerSimulado,
  restanteSegundos,
  salvarSimulado,
  sortearQuestoes,
} from "@/lib/simulado";

const LETRAS = ["A", "B", "C", "D", "E"];

type Fase = "intro" | "prova" | "resultado";

export default function SimuladoProva({ catalogo }: { catalogo: QuestaoSimulado[] }) {
  const [fase, setFase] = useState<Fase>("intro");
  const [estado, setEstado] = useState<SimuladoSalvo | null>(null);
  const [restante, setRestante] = useState(0);
  const [posicao, setPosicao] = useState(0);

  const porId = useMemo(() => new Map(catalogo.map((questao) => [questao.id, questao])), [catalogo]);

  // Recupera prova em andamento ou resultado salvo; prova expirada fecha sozinha;
  // ids que não batem mais com o catálogo são descartados.
  useEffect(() => {
    const salvo = lerSimulado();
    if (!salvo) return;
    if (!salvo.questoes.every((id) => porId.has(id))) {
      limparSimulado();
      return;
    }
    if (salvo.finalizadoEm) {
      setEstado(salvo);
      setFase("resultado");
      return;
    }
    if (restanteSegundos(salvo) > 0) {
      setEstado(salvo);
      setRestante(restanteSegundos(salvo));
      setFase("prova");
      return;
    }
    const fechado = { ...salvo, finalizadoEm: new Date().toISOString() };
    salvarSimulado(fechado);
    setEstado(fechado);
    setFase("resultado");
  }, [porId]);

  // Cronômetro: lê o salvo a cada tique (o localStorage é a fonte da verdade).
  useEffect(() => {
    if (fase !== "prova") return;
    const t = setInterval(() => {
      const salvo = lerSimulado();
      if (!salvo || salvo.finalizadoEm) return;
      const s = restanteSegundos(salvo);
      setRestante(s);
      if (s <= 0) finalizar({ ...salvo, finalizadoEm: new Date().toISOString() });
    }, 1000);
    return () => clearInterval(t);
  }, [fase]);

  function comecar() {
    const novo = iniciarSimulado(sortearQuestoes(catalogo));
    salvarSimulado(novo);
    setEstado(novo);
    setRestante(restanteSegundos(novo));
    setPosicao(0);
    setFase("prova");
  }

  function finalizar(fechado: SimuladoSalvo) {
    salvarSimulado(fechado);
    setEstado(fechado);
    setRestante(0);
    setFase("resultado");
    window.scrollTo(0, 0);
  }

  function responder(letra: string) {
    if (!estado || estado.finalizadoEm) return;
    const id = estado.questoes[posicao];
    const atualizado = { ...estado, respostas: { ...estado.respostas, [id]: letra } };
    salvarSimulado(atualizado);
    setEstado(atualizado);
  }

  function abandonar() {
    if (!window.confirm("Abandonar o simulado? As respostas desta prova serão perdidas.")) return;
    limparSimulado();
    setEstado(null);
    setFase("intro");
  }

  function finalizarAgora() {
    if (!estado) return;
    const faltando = estado.questoes.length - Object.keys(estado.respostas).length;
    if (faltando > 0 && !window.confirm(`Faltam ${faltando} questões. Finalizar mesmo assim?`)) return;
    finalizar({ ...estado, finalizadoEm: new Date().toISOString() });
  }

  if (fase === "intro") {
    return (
      <div className="mt-8 rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold">Como funciona</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li>
            {QUESTOES_SIMULADO} questões sorteadas entre as {catalogo.length} do banco, passando por todas
            as matérias
          </li>
          <li>Cronômetro de {DURACAO_MINUTOS / 60}h — ao zerar, a prova fecha sozinha</li>
          <li>A alternativa pode ser trocada até finalizar</li>
          <li>No fim: acertos totais e por matéria, gabarito de cada questão e link para o comentário</li>
        </ul>
        <button
          type="button"
          onClick={comecar}
          className="mt-5 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Iniciar simulado
        </button>
        <p className="mt-3 text-xs text-neutral-400">
          O andamento fica salvo neste navegador; reabrir a página retoma a prova.
        </p>
      </div>
    );
  }

  if (fase === "prova" && estado) {
    const questao = porId.get(estado.questoes[posicao]);
    if (!questao) return null;
    const respondidas = Object.keys(estado.respostas).length;
    return (
      <div className="mt-6">
        <div className="sticky top-0 z-10 -mx-6 border-b border-neutral-200 bg-white px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`font-mono text-lg tabular-nums ${restante < 300 ? "text-red-600" : ""}`}
              aria-label="Tempo restante"
            >
              {formatarTempo(restante)}
            </span>
            <span className="text-sm text-neutral-500">
              Questão {posicao + 1} de {estado.questoes.length} ·{" "}
              {respondidas === 1 ? "1 respondida" : `${respondidas} respondidas`}
            </span>
            <span className="flex gap-3">
              <button
                type="button"
                onClick={abandonar}
                className="text-sm text-neutral-400 transition-colors hover:text-neutral-700"
              >
                Abandonar
              </button>
              <button
                type="button"
                onClick={finalizarAgora}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                Finalizar
              </button>
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {estado.questoes.map((id, i) => {
            const respondida = id in estado.respostas;
            const corrente = i === posicao;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPosicao(i)}
                aria-label={`Ir para a questão ${i + 1}${respondida ? " (respondida)" : ""}`}
                aria-current={corrente ? "true" : undefined}
                className={`h-8 w-8 rounded-md text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                  respondida
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-600 hover:border-neutral-700"
                } ${corrente ? "ring-2 ring-neutral-900 ring-offset-2" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          <p className="text-sm text-neutral-500">
            {questao.materia} · ENEM {questao.exam} · questão {questao.question}
          </p>
          <img
            src={questao.image}
            alt={`Questão ${questao.question} do ENEM ${questao.exam}`}
            loading="lazy"
            className="mt-3 w-full rounded-xl border border-neutral-200"
          />
          <div className="mt-6 flex flex-wrap gap-3">
            {LETRAS.map((letra) => {
              const escolhida = estado.respostas[questao.id] === letra;
              return (
                <button
                  key={letra}
                  type="button"
                  onClick={() => responder(letra)}
                  aria-pressed={escolhida}
                  className={`min-w-14 rounded-lg border px-4 py-2.5 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                    escolhida
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 text-neutral-900 hover:border-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {letra}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              disabled={posicao === 0}
              onClick={() => setPosicao((p) => p - 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition-colors enabled:hover:border-neutral-700 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={posicao === estado.questoes.length - 1}
              onClick={() => setPosicao((p) => p + 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition-colors enabled:hover:border-neutral-700 disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (fase === "resultado" && estado) {
    const total = estado.questoes.length;
    let acertos = 0;
    const porMateria = new Map<string, { acertos: number; total: number }>();
    for (const id of estado.questoes) {
      const questao = porId.get(id);
      if (!questao) continue;
      const contagem = porMateria.get(questao.materia) ?? { acertos: 0, total: 0 };
      contagem.total += 1;
      if (estado.respostas[id] === questao.answer) {
        acertos += 1;
        contagem.acertos += 1;
      }
      porMateria.set(questao.materia, contagem);
    }
    return (
      <div className="mt-8">
        <div className="rounded-xl border border-neutral-200 p-6 text-center">
          <p className="text-4xl font-bold tracking-tight">
            {acertos}
            <span className="text-2xl text-neutral-400">/{total}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {total > 0 ? Math.round((acertos / total) * 100) : 0}% de acerto · gabarito abaixo
          </p>
          <p className="mt-4 text-sm text-neutral-600">
            {[...porMateria.entries()].map(([materia, c]) => `${materia} ${c.acertos}/${c.total}`).join(" · ")}
          </p>
        </div>

        <ul className="mt-8 space-y-4">
          {estado.questoes.map((id, i) => {
            const questao = porId.get(id);
            if (!questao) return null;
            const resposta = estado.respostas[id];
            const acertou = resposta === questao.answer;
            return (
              <li key={id} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{i + 1}.</span>
                  <span className="text-neutral-500">
                    {questao.materia} · ENEM {questao.exam} q{questao.question}
                  </span>
                  {resposta ? (
                    <span
                      className={`rounded-md border px-2 py-0.5 ${
                        acertou ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      Você: {resposta}
                    </span>
                  ) : (
                    <span className="rounded-md border border-neutral-200 px-2 py-0.5 text-neutral-400">Em branco</span>
                  )}
                  <span className="text-neutral-700">
                    Gabarito: <strong>{questao.answer}</strong>
                  </span>
                  <Link
                    href={`/unidade/${questao.unidadeId}${questao.ancora}`}
                    className="ml-auto text-neutral-500 transition-colors hover:text-neutral-900"
                  >
                    Ver comentário →
                  </Link>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-neutral-500 transition-colors hover:text-neutral-900">
                    Ver enunciado
                  </summary>
                  <img
                    src={questao.image}
                    alt={`Questão ${questao.question} do ENEM ${questao.exam}`}
                    loading="lazy"
                    className="mt-2 w-full rounded-lg border border-neutral-200"
                  />
                </details>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={comecar}
            className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Fazer novo simulado
          </button>
          <Link
            href="/"
            className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm transition-colors hover:border-neutral-700"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
