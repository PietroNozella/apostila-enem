import { subjects } from "./content";
import { banco } from "./banco";

export interface QuestaoEstudo {
  id: string;
  progressId: string;
  aliases: string[];
  image: string;
  exam: number;
  question: number;
  answer: string;
  area: string;
  subjectId: string;
  materia: string;
  assunto: string;
  idioma: "ing" | "esp" | null;
  aplicacao: "regular" | "ppl";
  commentary: string;
  sourceUrl: string;
  unidadeId: string;
  unidadeTitulo: string;
  ancora: string | null;
}

export function identidadeQuestao(ano: number, numero: number, idioma: string | null = null, aplicacao = "regular") {
  return `enem${ano}-${aplicacao === "regular" ? "" : `${aplicacao}-`}${numero}${idioma ? `-${idioma}` : ""}`;
}

export function urlProva(ano: number, numero: number, aplicacao = "regular") {
  const dia = numero <= 90 ? 1 : 2;
  return `https://download.inep.gov.br/enem/provas_e_gabaritos/${ano}_PV_${aplicacao === "regular" ? "impresso" : "reaplicacao_PPL"}_D${dia}_CD${dia === 1 ? 1 : 5}.pdf`;
}

const porIdentidade = new Map<string, QuestaoEstudo>();
for (const subject of subjects) {
  const idioma = subject.id === "ingles" ? "ing" : subject.id === "espanhol" ? "esp" : null;
  for (const unit of subject.units) {
    for (const [indice, q] of [unit.resolved, ...unit.training].entries()) {
      const progressId = `${unit.id}-${indice === 0 ? "resolvida" : `treino${indice}`}`;
      const id = identidadeQuestao(q.exam, q.question, idioma);
      porIdentidade.set(id, {
        id, progressId, aliases: [progressId, id], image: `/${q.images[0]}`, exam: q.exam,
        question: q.question, answer: q.answer, area: subject.area, subjectId: subject.id,
        materia: subject.name, assunto: unit.title, idioma, aplicacao: "regular", commentary: q.commentary,
        sourceUrl: urlProva(q.exam, q.question), unidadeId: unit.id, unidadeTitulo: unit.title,
        ancora: indice === 0 ? "#resolvida" : `#treino-${indice}`,
      });
    }
  }
}
for (const q of banco) {
  const existente = porIdentidade.get(q.id);
  if (existente) continue;
  if (!q.subjectId || q.revisada !== true) continue;
  const subject = subjects.find(s => s.id === q.subjectId);
  if (!subject) continue;
  porIdentidade.set(q.id, {
    id: q.id, progressId: q.id, aliases: [q.id], image: `/${q.image}`, exam: q.exam,
    question: q.question, answer: q.answer, area: q.area ?? subject.area,
    subjectId: subject.id, materia: subject.name, assunto: q.assunto ?? "Interpretação de questões",
    idioma: q.idioma ?? null, aplicacao: q.aplicacao ?? "regular", commentary: q.commentary ?? "", sourceUrl: q.sourceUrl ?? urlProva(q.exam, q.question),
    unidadeId: "", unidadeTitulo: "", ancora: null,
  });
}

export const questoes = [...porIdentidade.values()];
export const questoesDaMateria = (id: string) => questoes.filter(q => q.subjectId === id);
