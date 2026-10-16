import contentJson from "./content.json";

export interface Question {
  n: number;
  exam: number;
  question: number;
  images: string[];
  answer: string;
  answerSource: string;
  commentary: string;
}

export interface Unit {
  id: string;
  subject: string;
  number: number;
  title: string;
  explanation: string;
  resolved: Omit<Question, "n">;
  training: Question[];
}

export interface Subject {
  id: string;
  name: string;
  area: string;
  units: Unit[];
}

export interface Meta {
  source: string;
  subjects: number;
  units: number;
  questions: number;
}

/** content.json gerado por tools/build_content.py + tools/apply_gabaritos.py */
export const content = contentJson as unknown as { meta: Meta; subjects: Subject[] };

export const subjects: Subject[] = content.subjects;
export const meta: Meta = content.meta;

export function getSubject(id: string): Subject | undefined {
  return subjects.find((s) => s.id === id);
}

export function getUnit(id: string): { subject: Subject; unit: Unit } | undefined {
  for (const subject of subjects) {
    const unit = subject.units.find((u) => u.id === id);
    if (unit) return { subject, unit };
  }
  return undefined;
}

export function paragraphs(text: string): string[] {
  return text.split("\n\n").filter(Boolean);
}
