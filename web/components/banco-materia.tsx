"use client";

import { useState } from "react";
import type { QuestaoEstudo } from "@/lib/questoes";
import { useProgresso } from "@/lib/use-progresso";
import { respostaMaisRecente } from "@/lib/progresso-dados";
import TreinoInterativo from "./treino-interativo";

const POR_PAGINA = 5;
const SELECT = "mt-1 block max-w-full rounded-lg border p-2";

export default function BancoMateria({ questoes }: { questoes: QuestaoEstudo[] }) {
  const progresso = useProgresso();
  const [assunto, setAssunto] = useState("");
  const [ano, setAno] = useState("");
  const [situacao, setSituacao] = useState("");
  const [revisao, setRevisao] = useState<string[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [rodada, setRodada] = useState(0);
  const [recente, setRecente] = useState<string | null>(null);

  const porTema = questoes.filter(q =>
    (!assunto || q.assunto === assunto) && (!ano || String(q.exam) === ano),
  );
  const erradas = porTema.filter(q => {
    const resposta = respostaMaisRecente(progresso, q.aliases);
    return resposta && !resposta.correct;
  });
  const filtradas = revisao
    ? questoes.filter(q => revisao.includes(q.id))
    : porTema.filter(q => {
      // Mantém o feedback visível após responder uma questão filtrada.
      if (q.id === recente || !situacao) return true;
      const resposta = respostaMaisRecente(progresso, q.aliases);
      if (situacao === "novas") return !resposta;
      if (situacao === "erradas") return resposta && !resposta.correct;
      return resposta?.correct;
    });
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const inicio = paginaAtual * POR_PAGINA;
  const assuntos = [...new Set(questoes.map(q => q.assunto))].sort();
  const anos = [...new Set(questoes.map(q => q.exam))].sort((a, b) => b - a);

  function filtrar(atualizar: () => void) {
    atualizar();
    setPagina(0);
    setRevisao(null);
    setRecente(null);
  }

  function revisarErros() {
    setRevisao(erradas.map(q => q.id));
    setPagina(0);
    setRodada(r => r + 1);
    setRecente(null);
  }

  return (
    <section className="mt-12" id="banco">
      <h2 className="text-2xl font-semibold">Treinar por questões</h2>
      <p className="mt-2 text-sm text-neutral-500">
        {questoes.length} questões disponíveis. O gabarito aparece depois da resposta.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <label className="min-w-0 max-w-full text-sm">
          Assunto
          <select aria-label="Assunto" className={SELECT} value={assunto}
            onChange={e => filtrar(() => setAssunto(e.target.value))}>
            <option value="">Todos os assuntos</option>
            {assuntos.map(a => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="min-w-0 max-w-full text-sm">
          Ano
          <select aria-label="Ano" className={SELECT} value={ano}
            onChange={e => filtrar(() => setAno(e.target.value))}>
            <option value="">Todos os anos</option>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="min-w-0 max-w-full text-sm">
          Situação
          <select aria-label="Situação" className={SELECT} value={situacao}
            onChange={e => filtrar(() => setSituacao(e.target.value))}>
            <option value="">Todas</option>
            <option value="novas">Não respondidas</option>
            <option value="erradas">Erradas</option>
            <option value="corretas">Corretas</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={erradas.length === 0}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40" onClick={revisarErros}>
          Refazer erradas ({erradas.length})
        </button>
        {revisao && (
          <button type="button" className="text-sm underline" onClick={() => setRevisao(null)}>
            Sair da revisão
          </button>
        )}
        <p role="status" className="text-sm text-neutral-500">
          {filtradas.length} questões {revisao ? "nesta revisão" : "encontradas"}
        </p>
      </div>
      {filtradas.length === 0 && <p className="mt-6">Nenhuma questão para estes filtros.</p>}
      {filtradas.slice(inicio, inicio + POR_PAGINA).map(q => (
        <TreinoInterativo
          key={`${q.id}-${rodada}-${Boolean(revisao)}`}
          questionId={q.progressId}
          aliases={q.aliases}
          heading={q.assunto}
          exam={q.exam}
          question={q.question}
          aplicacao={q.aplicacao}
          image={q.image}
          answer={q.answer}
          paragraphs={q.commentary.split("\n\n").filter(Boolean)}
          revisao={Boolean(revisao)}
          sourceUrl={q.sourceUrl}
          onAnswered={() => setRecente(q.id)}
        />
      ))}
      {paginas > 1 && (
        <nav aria-label="Páginas de questões" className="mt-8 flex items-center justify-between gap-3">
          <button type="button" disabled={paginaAtual === 0}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
            onClick={() => { setPagina(paginaAtual - 1); setRecente(null); }}>
            Anterior
          </button>
          <span className="text-sm">{paginaAtual + 1} / {paginas}</span>
          <button type="button" disabled={paginaAtual + 1 >= paginas}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
            onClick={() => { setPagina(paginaAtual + 1); setRecente(null); }}>
            Próxima
          </button>
        </nav>
      )}
    </section>
  );
}
