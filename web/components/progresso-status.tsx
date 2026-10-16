"use client";
import { useSincronizacao } from "@/lib/use-progresso";
import { sincronizar } from "@/lib/progresso";

const MENSAGENS: Record<string, string> = {
  enviando: "Sincronizando progresso…",
  pendente: "Há respostas aguardando sincronização. Tentaremos novamente ao reconectar.",
  salvo: "Progresso sincronizado.",
  memoria: "O navegador não permitiu salvar. Mantenha esta página aberta para não perder as respostas.",
  local: "Progresso salvo neste navegador.",
};
export default function ProgressoStatus() {
  const status = useSincronizacao();
  return <aside className="mx-auto w-full max-w-5xl px-6 pb-6 text-sm text-neutral-600" aria-label="Salvamento do progresso">
    <p role="status">{MENSAGENS[status]}</p>
    {status === "pendente" && <button type="button" className="mt-2 rounded-lg border px-4 py-2" onClick={sincronizar}>Tentar sincronizar agora</button>}
  </aside>;
}
