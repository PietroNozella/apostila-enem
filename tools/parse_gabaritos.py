# -*- coding: utf-8 -*-
"""Parseia os PDFs de gabarito do INEP e gera data/gabaritos.json.

Estrutura dos gabaritos do 1o dia: questoes 1-5 tem DUAS colunas
(INGLES, ESPANHOL); as demais tem uma unica letra (comum).
2o dia: letra unica para 91-180.

Saida:
{
  "2023-1": {"common": {...}, "ingles": {"1".."5"}, "espanhol": {"1".."5"}},
  "2023-2": {"common": {...}, "ingles": {}, "espanhol": {}},
  ...
}
"""
import json
import os
import re
import sys

import pymupdf

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAB_DIR = os.path.join(PROJ, "data", "gabaritos_inep")
FILES = {
    "2023-1": "2023_d1_cd1.pdf",
    "2023-2": "2023_d2_cd5.pdf",
    "2024-1": "2024_d1_cd1.pdf",
    "2024-2": "2024_d2_cd5.pdf",
    "2025-1": "2025_d1_cd1.pdf",
    "2025-2": "2025_d2_cd5.pdf",
}
LETTER = re.compile(r"^[A-E]$")

# Faixa esperada por chave, para validar a completude do parse
ESPERADO = {"1": (6, 90), "2": (91, 180)}


def parse_table(path):
    doc = pymupdf.open(path)
    lines = []
    for page in doc:
        for raw in page.get_text().split("\n"):
            t = raw.strip()
            if t:
                lines.append(t)

    common, ingles, espanhol = {}, {}, {}
    i = 0
    while i < len(lines):
        if lines[i].isdigit():
            n = int(lines[i])
            letters = []
            j = i + 1
            while j < len(lines) and len(letters) < 2 and LETTER.match(lines[j]):
                letters.append(lines[j])
                j += 1
            if n <= 5 and len(letters) == 2:
                ingles[str(n)] = letters[0]
                espanhol[str(n)] = letters[1]
                i = j
                continue
            if letters:
                common[str(n)] = letters[0]
                i = j
                continue
        i += 1
    return common, ingles, espanhol


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    result = {}
    out = []
    for key, fname in FILES.items():
        common, ingles, espanhol = parse_table(os.path.join(GAB_DIR, fname))
        result[key] = {"common": dict(sorted(common.items(), key=lambda kv: int(kv[0]))),
                       "ingles": dict(sorted(ingles.items())),
                       "espanhol": dict(sorted(espanhol.items()))}
        nums = sorted(int(k) for k in common)
        dia = key.split("-")[1]
        ini, fim = ESPERADO[dia]
        faltando = [str(n) for n in range(ini, fim + 1) if str(n) not in common]
        out.append(f"## {key}: comuns {len(common)} ({nums[0]}-{nums[-1]}) | inglês: {ingles} | espanhol: {espanhol}")
        if faltando:
            out.append(f"   ATENÇÃO {key}: sem letra para {len(faltando)} questões comuns: {faltando}")

    with open(os.path.join(PROJ, "data", "gabaritos.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)

    print("\n".join(out))


if __name__ == "__main__":
    main()
