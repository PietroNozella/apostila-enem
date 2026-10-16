# -*- coding: utf-8 -*-
"""Valida o content.json gerado."""
import json
import os
import re

PROJ = r"C:\Users\Micro\enem-treino"
content = json.load(open(os.path.join(PROJ, "data", "content.json"), encoding="utf-8"))
IMG_DIR = os.path.join(PROJ, "data", "images")
CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

out = []
missing_files = []
resolved_with_answer = 0
resolved_total = 0
qa = []

def qa_row(label, ex, qn, ans, cmt, imgs):
    ok_img = all(os.path.exists(os.path.join(PROJ, "data", im)) for im in imgs)
    if not ok_img:
        missing_files.append((label, imgs))
    qa.append((label, ex, qn, ans, len(cmt), imgs, ok_img))

for subj in content["subjects"]:
    out.append(f"## {subj['name']} ({subj['area']}) - {len(subj['units'])} unidades")
    for u in subj["units"]:
        r = u["resolved"]
        resolved_total += 1
        if r["answer"]:
            resolved_with_answer += 1
        qa_row(f"{u['id']} R", r["exam"], r["question"], r["answer"], r["commentary"], r["images"])
        t0, t1 = u["training"]
        qa_row(f"{u['id']} T1", t0["exam"], t0["question"], t0["answer"], t0["commentary"], t0["images"])
        qa_row(f"{u['id']} T2", t1["exam"], t1["question"], t1["answer"], t1["commentary"], t1["images"])
        expl_len = len(u["explanation"])
        flags = []
        texts = (u["explanation"], r["commentary"], t0["commentary"], t1["commentary"])
        for label, txt in zip(("EXP", "R", "T1", "T2"), texts):
            if CTRL.search(txt):
                flags.append(f"CARACTERE_DE_CONTROLE({label})")
        if expl_len < 200: flags.append(f"EXPL_CURTA({expl_len})")
        if not r["commentary"]: flags.append("R_SEM_COMENTARIO")
        if len(r["commentary"]) < 80: flags.append("R_COMENTARIO_CURTO")
        if flags:
            out.append(f"   !! {u['id']}: {flags}")
    out.append("")

out.append("=== tabela de questoes (label | ano | n | resposta | len_comentario | #imgs | img_ok) ===")
for row in qa:
    out.append(" | ".join(str(x) for x in row))

n_img_files = len([f for f in os.listdir(IMG_DIR) if f.endswith(".png")])
out.append("")
out.append(f"arquivos de imagem: {n_img_files}")
out.append(f"resolvidas com letra extraida: {resolved_with_answer}/{resolved_total}")
out.append(f"arquivos faltando: {missing_files}")

open(os.path.join(PROJ, "data", "validation.txt"), "w", encoding="utf-8").write("\n".join(out))
print("ok - linhas:", len(out))
