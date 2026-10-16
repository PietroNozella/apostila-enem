/** Banco de questões das provas oficiais (gerado por tools/extract_prova.py). */
import bancoJson from "./banco.json";

export interface BancoMeta {
  source: string;
  exam?: number;
  exams?: number[];
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
  area?: string;
  subjectId?: string;
  assunto?: string;
  aplicacao?: "regular" | "ppl";
  dia?: number;
  caderno?: number;
  idioma?: "ing" | "esp" | null;
  sourceUrl?: string;
  commentary?: string;
  revisada?: boolean;
}

export const bancoMeta: BancoMeta = (bancoJson as { meta: BancoMeta }).meta;
export const banco: QuestaoBanco[] = (bancoJson as { questoes: QuestaoBanco[] }).questoes;
