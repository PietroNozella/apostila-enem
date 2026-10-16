# -*- coding: utf-8 -*-
"""Cruza content.json com os gabaritos oficiais do INEP (colunas por idioma).

- Resolvidas: sempre preenche a letra com a oficial (INEP).
  Se o comentario da apostila ja tinha uma letra, confere se bate.
- Treinos: confere a letra extraida da apostila contra a oficial.
"""
import json

PROJ = r"C:\Users\Micro\enem-treino"
DAY1 = {"Linguagens", "Ciências Humanas"}
LANG_COL = {"Inglês": "ingles", "Espanhol": "espanhol"}


def official_for(gab, subject, area, exam, number):
    day = 1 if area in DAY1 else 2
    table = gab.get(f"{exam}-{day}")
    if not table:
        return None
    s = str(number)
    lang = LANG_COL.get(subject)
    if lang and s in table[lang]:
        return table[lang][s]
    return table["common"].get(s)


def main():
    content = json.load(open(PROJ + r"\data\content.json", encoding="utf-8"))
    gab = json.load(open(PROJ + r"\data\gabaritos.json", encoding="utf-8"))

    out = []
    treino_mismatch = []
    commentary_mismatch = []
    commentary_checked = 0
    resolved_filled = 0
    missing = []
    total = 0

    for subj in content["subjects"]:
        for u in subj["units"]:
            r = u["resolved"]
            total += 1
            official = official_for(gab, subj["name"], subj["area"], r["exam"], r["question"])
            if official is None:
                missing.append(f"{u['id']} R ({r['exam']} q{r['question']})")
                continue
            prev = r["answer"]
            if prev:
                commentary_checked += 1
                if prev != official:
                    commentary_mismatch.append(
                        f"{u['id']} R: comentario {prev} != oficial {official} ({r['exam']} q{r['question']})")
            else:
                resolved_filled += 1
            r["answer"] = official
            r["answerSource"] = "apostila+inep" if prev else "inep"
            for t in u["training"]:
                total += 1
                official = official_for(gab, subj["name"], subj["area"], t["exam"], t["question"])
                if official is None:
                    missing.append(f"{u['id']} T{t['n']} ({t['exam']} q{t['question']})")
                    continue
                if t["answer"] != official:
                    treino_mismatch.append(
                        f"{u['id']} T{t['n']}: apostila {t['answer']} != oficial {official} ({t['exam']} q{t['question']})")
                else:
                    t["answerSource"] = "apostila+inep"

    with open(PROJ + r"\data\content.json", "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)

    out.append(f"questoes totais: {total}")
    out.append(f"resolvidas com letra preenchida pelo INEP: {resolved_filled}")
    out.append(f"letras de comentarios conferidas contra INEP: {commentary_checked}")
    out.append(f"divergencias comentario vs INEP: {len(commentary_mismatch)}")
    out += commentary_mismatch
    out.append(f"divergencias treino vs INEP: {len(treino_mismatch)}")
    out += treino_mismatch
    out.append(f"sem gabarito oficial: {len(missing)}")
    out += missing
    report = "\n".join(out)
    open(PROJ + r"\data\gabarito_check.txt", "w", encoding="utf-8").write(report)
    print(report)


if __name__ == "__main__":
    main()
