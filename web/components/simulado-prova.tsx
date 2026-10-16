"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import ImagemQuestao from "./imagem-questao";
import { getResposta, salvarResposta } from "@/lib/progresso";
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

const observarHidratacao = () => () => {};

export default function SimuladoProva({ catalogo }: { catalogo: QuestaoSimulado[] }) {
  const pronto = useSyncExternalStore(observarHidratacao, () => true, () => false);
  return pronto ? <Prova catalogo={catalogo} /> : <p className="mt-6" role="status">Preparando simulado…</p>;
}

function Prova({ catalogo }: { catalogo: QuestaoSimulado[] }) {
  const porId = useMemo(() => new Map(catalogo.flatMap(q => (q.aliases ?? [q.id]).map(id => [id, q] as const))), [catalogo]);
  const [estado, setEstado] = useState<SimuladoSalvo | null>(() => {
    const salvo = lerSimulado();
    if (!salvo || !salvo.questoes.every(id => porId.has(id))) return null;
    return !salvo.finalizadoEm && restanteSegundos(salvo) === 0 ? { ...salvo, finalizadoEm: salvo.expiraEm } : salvo;
  });
  const [restante, setRestante] = useState(() => estado ? restanteSegundos(estado) : 0);
  const [posicao, setPosicao] = useState(0);
  const [idioma, setIdioma] = useState<"ing" | "esp">(estado?.idioma ?? "ing");
  const fase = !estado ? "intro" : estado.finalizadoEm ? "resultado" : "prova";

  useEffect(() => {
    if (!estado) return;
    salvarSimulado(estado);
    if (!estado.finalizadoEm) return;
    for (const id of estado.questoes) {
      const q = porId.get(id);
      const choice = estado.respostas[id];
      const progressId = q?.progressId ?? id;
      if (q && choice && (!getResposta(progressId) || Date.parse(getResposta(progressId)!.answeredAt) < Date.parse(estado.finalizadoEm))) {
        salvarResposta(progressId, { choice, correct: choice === q.answer, answeredAt: estado.finalizadoEm });
      }
    }
  }, [estado, porId]);

  useEffect(() => {
    if (!estado || estado.finalizadoEm) return;
    const timer = setInterval(() => {
      const segundos = restanteSegundos(estado);
      setRestante(segundos);
      if (segundos === 0) setEstado(atual => atual && !atual.finalizadoEm ? { ...atual, finalizadoEm: atual.expiraEm } : atual);
    }, 1000);
    return () => clearInterval(timer);
  }, [estado]);

  function comecar() {
    const novo = iniciarSimulado(sortearQuestoes(catalogo, QUESTOES_SIMULADO, idioma), idioma);
    salvarSimulado(novo);
    setEstado(novo);
    setRestante(restanteSegundos(novo));
    setPosicao(0);
  }

  function finalizar(fechado: SimuladoSalvo) {
    salvarSimulado(fechado);
    setEstado(fechado);
    setRestante(0);
    window.scrollTo(0, 0);
  }

  function responder(letra: string) {
    if (!estado || estado.finalizadoEm) return;
    if (restanteSegundos(estado) === 0) {
      finalizar({ ...estado, finalizadoEm: estado.expiraEm });
      return;
    }
    const id = estado.questoes[posicao];
    const atualizado = { ...estado, respostas: { ...estado.respostas, [id]: letra } };
    salvarSimulado(atualizado);
    setEstado(atualizado);
  }

  function abandonar() {
    if (!window.confirm("Abandonar o simulado? As respostas desta prova serão perdidas.")) return;
    limparSimulado();
    setEstado(null);
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
            {QUESTOES_SIMULADO} questões sorteadas entre as {catalogo.length} do banco, distribuídas entre as quatro áreas
          </li>
          <li>Cronômetro de {Math.floor(DURACAO_MINUTOS / 60)}h{DURACAO_MINUTOS % 60} — ao zerar, a prova fecha sozinha</li>
          <li>A alternativa pode ser trocada até finalizar</li>
          <li>No fim: acertos totais e por matéria, gabarito de cada questão e link para o comentário</li>
        </ul>
        <label className="mt-5 block text-sm">Língua estrangeira
          <select aria-label="Língua estrangeira" value={idioma} onChange={e => setIdioma(e.target.value as "ing" | "esp")} className="ml-3 rounded-lg border p-2"><option value="ing">Inglês</option><option value="esp">Espanhol</option></select>
        </label>
        <p className="mt-3 text-sm text-neutral-500">Formato reduzido de treino: 45 questões em 150 minutos.</p>
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
            {questao.materia} · ENEM {questao.exam}{questao.aplicacao === "ppl" ? " · Reaplicação/PPL" : ""} · questão {questao.question}
          </p>
          <ImagemQuestao src={questao.image} alt={`Questão ${questao.question} do ENEM ${questao.exam}`} />
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
                    {questao.materia} · ENEM {questao.exam}{questao.aplicacao === "ppl" ? " · Reaplicação/PPL" : ""} q{questao.question}
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
                  {questao.ancora && (
                    <Link
                      href={`/unidade/${questao.unidadeId}${questao.ancora}`}
                      className="ml-auto text-neutral-500 transition-colors hover:text-neutral-900"
                    >
                      Ver comentário →
                    </Link>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-neutral-500 transition-colors hover:text-neutral-900">
                    Ver enunciado
                  </summary>
                  <ImagemQuestao src={questao.image} alt={`Questão ${questao.question} do ENEM ${questao.exam}`} />
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
