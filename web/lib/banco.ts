/** Banco de questões das provas oficiais (gerado por tools/extract_prova.py). */
import bancoJson from "./banco.json";

export interface BancoMeta {
  source: string;
  exam: number;
  questoes: number;
  anuladas: string[];
}

export interface QuestaoBanco {
  id: string;
  exam: number;
  question: number;
  image: string;
  answer: string;
  answerSource: string;
  materia: string;
  ancora: null;
}

export const bancoMeta: BancoMeta = (bancoJson as { meta: BancoMeta }).meta;
export const banco: QuestaoBanco[] = (bancoJson as { questoes: QuestaoBanco[] }).questoes;
