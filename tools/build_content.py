# -*- coding: utf-8 -*-
"""
Pipeline de extracao da Apostila ENEM 2026 V3 -> JSON estruturado + imagens.

Entrada:  PDF da apostila (texto + imagens embutidas por questao)
Saida:    data/content.json  +  data/images/*.png (uma imagem por questao;
          questoes divididas em varias paginas sao costuradas verticalmente)

Estrategia: varredura global do documento, em ordem de leitura (pagina, y).
Cada unidade comeca quando um bloco de titulo "NN Titulo" (igual ao sumario)
aparece - unidades podem compartilhar paginas com o gabarito da anterior.
O conteudo termina ao encontrar a secao "Indice de todos os conteudos".

Uso: python tools/build_content.py [caminho_do_pdf]
"""
import io
import json
import os
import re
import sys
import unicodedata

import pymupdf
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Micro\Downloads\Apostila de estudo ENEM.pdf"
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(PROJ, "data", "images")
JSON_PATH = os.path.join(PROJ, "data", "content.json")

SUBJECTS = ["Português", "Literatura", "Inglês", "Espanhol", "Arte",
            "História", "Geografia", "Filosofia", "Sociologia",
            "Biologia", "Física", "Química", "Matemática"]
AREA = {"Português": "Linguagens", "Literatura": "Linguagens", "Inglês": "Linguagens",
        "Espanhol": "Linguagens", "Arte": "Linguagens",
        "História": "Ciências Humanas", "Geografia": "Ciências Humanas",
        "Filosofia": "Ciências Humanas", "Sociologia": "Ciências Humanas",
        "Biologia": "Ciências da Natureza", "Física": "Ciências da Natureza",
        "Química": "Ciências da Natureza", "Matemática": "Matemática"}
AREAS = set(AREA.values())
SKIP_TOC = {"Sumário", "Índice de todos os conteúdos", "Fontes, créditos e conferência"}
STOP_SECTIONS = ("Índice de todos os conteúdos", "Fontes, créditos e conferência")

RE_UNIT_TITLE = re.compile(r"^(\d{2})\s+(.+)$")
RE_RESOLVED = re.compile(r"^Resolvida\s*\|\s*ENEM\s*(\d{4})\s*\|\s*quest[ãa]o\s*(\d+)")
RE_TREINO = re.compile(r"^Treino\s*(\d)\s*\|\s*ENEM\s*(\d{4})\s*\|\s*quest[ãa]o\s*(\d+)")
RE_ANSWER = re.compile(r"^Treino\s*(\d)\s*[•·]?\s*Resposta\s*([A-E])\b")
RE_CHROME_HEAD = re.compile(r"^ENEM 2026\b")
RE_CHROME_FOOT = re.compile(r"^\d{1,3}\s*/\s*199\b")


def slugify(text):
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", norm.lower()).strip("-")


# \x00 na extração = glifo de união ∪ (fonte do PDF perde o mapeamento);
# ex.: n(A∪B)=n(A)+n(B)−n(A∩B), v. matematica-06
CONTROL_GLYPHS = {"\x00": "∪"}


def norm_ws(t):
    return " ".join(t.translate(CONTROL_GLYPHS).split())


def is_chrome(t):
    return (RE_CHROME_HEAD.match(t) or RE_CHROME_FOOT.match(t) or
            t == "Sumário" or t in SUBJECTS or t in AREAS)


def parse_toc(doc):
    """Le paginas 3-4 e devolve [(subject, title)] na ordem."""
    units = []
    subject = None
    for pno in (3, 4):
        blocks = sorted(doc[pno - 1].get_text("blocks"), key=lambda b: (b[1], b[0]))
        for b in blocks:
            if b[6] != 0:
                continue
            lines = [ln.strip() for ln in b[4].split("\n") if ln.strip()]
            if not lines:
                continue
            if len(lines) == 1:
                if lines[0] in SUBJECTS:
                    subject = lines[0]
                continue
            last = lines[-1]
            if last.isdigit():
                title = " ".join(lines[:-1]).strip()
                units.append((subject, title))
    return [(s, t) for (s, t) in units if t not in SKIP_TOC]


def new_unit_state(subject, title, number):
    return {
        "subject": subject, "title": title, "number": number,
        "expl": [],
        "resolved": {"exam": None, "question": None, "images": [], "commentary": [], "answer": None},
        "treinos": {1: {"exam": None, "question": None, "images": [], "answer": None, "commentary": []},
                    2: {"exam": None, "question": None, "images": [], "answer": None, "commentary": []}},
        "state": "expl",
        "saw_resolved": False, "saw_gabarito": False,
    }


def finalize_unit(st, anomalies):
    unit_id = f"{slugify(st['subject'])}-{st['number']:02d}"
    resolved = st["resolved"]
    comment = " ".join(resolved["commentary"])
    for rx in (r"Por isso,\s*([A-E])\b", r"\bLogo,\s*([A-E])\b", r"\bAssim,\s*([A-E])\b",
               r"\bPortanto,\s*([A-E])\b", r"alternativa\s+([A-E])[.,]",
               r"[Rr]esposta\s+([A-E])[.,]", r"letra\s+([A-E])\b"):
        mm = re.search(rx, comment)
        if mm:
            resolved["answer"] = mm.group(1)
            break

    if not st["saw_resolved"]:
        anomalies.append(f"{unit_id}: sem questao resolvida")
    if not st["saw_gabarito"]:
        anomalies.append(f"{unit_id}: sem gabarito")
    if not st["expl"]:
        anomalies.append(f"{unit_id}: explicacao vazia")
    if not resolved["images"]:
        anomalies.append(f"{unit_id}: resolvida sem imagem")
    for n in (1, 2):
        tr = st["treinos"][n]
        if not tr["images"]:
            anomalies.append(f"{unit_id}: treino {n} sem imagem")
        if not tr["answer"]:
            anomalies.append(f"{unit_id}: treino {n} sem resposta")
        if not tr["commentary"]:
            anomalies.append(f"{unit_id}: treino {n} sem comentario")

    unit = {
        "id": unit_id,
        "subject": st["subject"],
        "number": st["number"],
        "title": st["title"],
        "explanation": "\n\n".join(st["expl"]),
        "resolved": {
            "exam": resolved["exam"], "question": resolved["question"],
            "images": resolved["images"], "answer": resolved["answer"],
            "commentary": "\n\n".join(resolved["commentary"]),
        },
        "training": [
            {
                "n": n,
                "exam": st["treinos"][n]["exam"], "question": st["treinos"][n]["question"],
                "images": st["treinos"][n]["images"], "answer": st["treinos"][n]["answer"],
                "commentary": "\n\n".join(st["treinos"][n]["commentary"]),
            }
            for n in (1, 2)
        ],
    }
    return unit_id, unit


def scan_document(doc, toc, anomalies):
    units_out = []
    counters = {}
    idx = 0
    current = None
    finished = False

    def flush():
        nonlocal current
        if current is None:
            return
        unit_id, unit = finalize_unit(current, anomalies)
        units_out.append(unit)
        current = None

    for pno in range(1, doc.page_count + 1):
        page = doc[pno - 1]
        events = []
        for b in page.get_text("blocks"):
            if b[6] != 0:
                continue
            t = norm_ws(b[4])
            if not t or is_chrome(t):
                continue
            events.append((b[1], "text", t))
        for im in page.get_images(full=True):
            for r in page.get_image_rects(im[0]):
                events.append((r.y0, "img", im[0]))
        events.sort(key=lambda e: e[0])

        for y, kind, val in events:
            if finished:
                continue

            if kind == "img":
                if current is None:
                    anomalies.append(f"p{pno}: imagem fora de unidade")
                    continue
                st = current["state"]
                if st == "resolved":
                    current["resolved"]["images"].append(val)
                elif st == "treino1":
                    current["treinos"][1]["images"].append(val)
                elif st == "treino2":
                    current["treinos"][2]["images"].append(val)
                else:
                    anomalies.append(
                        f"{slugify(current['subject'])}-{current['number']:02d}: imagem (p{pno}) sem questao aberta (state={st})")
                continue

            t = val
            if t.startswith(STOP_SECTIONS):
                if current is not None:
                    flush()
                    finished = True
                continue

            m = RE_UNIT_TITLE.match(t)
            if m and idx < len(toc) and m.group(2) == toc[idx][1]:
                flush()
                subject, title = toc[idx]
                counters[subject] = counters.get(subject, 0) + 1
                current = new_unit_state(subject, title, counters[subject])
                if int(m.group(1)) != counters[subject]:
                    anomalies.append(
                        f"{slugify(subject)}-{counters[subject]:02d}: numero impresso {m.group(1)} != sequencia")
                idx += 1
                continue
            if m and idx < len(toc) and idx + 1 < len(toc) and m.group(2) == toc[idx + 1][1]:
                anomalies.append(f"unidade pulada: {toc[idx][1]} (titulo nao encontrado)")
                flush()
                idx += 1
                subject, title = toc[idx]
                counters[subject] = counters.get(subject, 0) + 1
                current = new_unit_state(subject, title, counters[subject])
                idx += 1
                continue

            if current is None:
                continue
            st = current

            if t == "Acompanhe uma questão real":
                st["state"] = "resolved"
                continue
            mm = RE_RESOLVED.match(t)
            if mm:
                st["resolved"]["exam"], st["resolved"]["question"] = int(mm.group(1)), int(mm.group(2))
                st["state"] = "resolved"
                st["saw_resolved"] = True
                continue
            if t == "Como chegar à resposta":
                st["state"] = "resolved_comment"
                continue
            if t == "Agora resolva sem consultar a correção":
                st["state"] = "training"
                continue
            mm = RE_TREINO.match(t)
            if mm:
                n = int(mm.group(1))
                st["treinos"][n]["exam"], st["treinos"][n]["question"] = int(mm.group(2)), int(mm.group(3))
                st["state"] = f"treino{n}"
                continue
            if t == "Gabarito comentado":
                st["state"] = "gabarito"
                st["saw_gabarito"] = True
                continue
            mm = RE_ANSWER.match(t)
            if mm:
                n = int(mm.group(1))
                st["treinos"][n]["answer"] = mm.group(2)
                st["state"] = f"gab{n}"
                continue

            s = st["state"]
            if s == "expl":
                st["expl"].append(t)
            elif s == "resolved_comment":
                st["resolved"]["commentary"].append(t)
            elif s.startswith("gab"):
                st["treinos"][int(s[-1])]["commentary"].append(t)
            # estados de cabecalho/transicao: ignora texto solto

    flush()
    if idx != len(toc):
        anomalies.append(f"unidades nao encontradas: {len(toc) - idx} restantes no sumario")
    return units_out


def save_question_image(doc, xrefs, out_path):
    parts = []
    for xref in xrefs:
        info = doc.extract_image(xref)
        parts.append(Image.open(io.BytesIO(info["image"])))
    if not parts:
        return False
    if len(parts) == 1:
        img = parts[0]
    else:
        width = max(p.width for p in parts)
        height = sum(p.height for p in parts)
        img = Image.new("RGB", (width, height), "white")
        yy = 0
        for p in parts:
            p = p.convert("RGB")
            img.paste(p, (0, yy))
            yy += p.height
    img.convert("RGB").save(out_path, "PNG", optimize=True)
    return True


def main():
    doc = pymupdf.open(SRC)
    os.makedirs(IMG_DIR, exist_ok=True)
    toc = parse_toc(doc)
    print(f"unidades no sumario: {len(toc)}")

    anomalies = []
    units = scan_document(doc, toc, anomalies)

    subjects_out = {}
    order = []
    for unit in units:
        s = unit["subject"]
        if s not in subjects_out:
            subjects_out[s] = {"id": slugify(s), "name": s, "area": AREA.get(s), "units": []}
            order.append(s)
        subjects_out[s]["units"].append(unit)

    for unit in units:
        uid = unit["id"]
        resolved_imgs = unit["resolved"]["images"]
        if resolved_imgs and all(isinstance(x, int) for x in resolved_imgs):
            save_question_image(doc, resolved_imgs, os.path.join(IMG_DIR, f"{uid}-resolvida.png"))
            unit["resolved"]["images"] = [f"images/{uid}-resolvida.png"]
        for tr in unit["training"]:
            imgs = tr["images"]
            if imgs and all(isinstance(x, int) for x in imgs):
                fname = f"{uid}-treino{tr['n']}.png"
                save_question_image(doc, imgs, os.path.join(IMG_DIR, fname))
                tr["images"] = [f"images/{fname}"]

    content = {
        "meta": {
            "source": "Apostila ENEM 2026 - Estudo por questoes - V3",
            "subjects": len(order),
            "units": len(units),
            "questions": len(units) * 3,
        },
        "subjects": [subjects_out[s] for s in order],
    }
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)

    report = [f"subjects: {content['meta']['subjects']}",
              f"units: {content['meta']['units']}",
              f"question slots: {content['meta']['questions']}",
              f"anomalias: {len(anomalies)}"]
    report += anomalies
    with open(os.path.join(PROJ, "data", "extraction_report.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(report))
    print("\n".join(report[:100]))


if __name__ == "__main__":
    main()
