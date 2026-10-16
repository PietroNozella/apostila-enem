"use client";
import { useSyncExternalStore } from "react";
import { observarProgresso, snapshotProgresso, snapshotSincronizacao, getCodigo, type Progresso } from "./progresso";
import { progressoValido } from "./progresso-dados";

export function useProgresso(): Progresso {
  const raw = useSyncExternalStore(observarProgresso, snapshotProgresso, () => "{}");
  try { const dados: unknown = JSON.parse(raw); return progressoValido(dados) ? dados : {}; }
  catch { return {}; }
}
export function useCodigo() { return useSyncExternalStore(observarProgresso, getCodigo, () => null); }
export function useSincronizacao() { return useSyncExternalStore(observarProgresso, snapshotSincronizacao, () => "local"); }
