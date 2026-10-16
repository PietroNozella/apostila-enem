# -*- coding: utf-8 -*-
"""Extrai PDFs oficiais para um lote de revisão, sem alterar o banco publicado.

Entrada: provas e gabaritos em data/provas_inep/<ano>/, cadernos D1 CD1 e D2 CD5.
Saída: data/images/enem<ano>-*.webp e data/lotes/<ano>-<aplicacao>.json.
O parser lê linhas em ordem de coluna, une continuações e inclui os textos
compartilhados em todas as questões do grupo. Preserva os dois idiomas e
exclui apenas anulações explicitamente registradas no gabarito oficial.
Erros de leitura retornam código de saída não zero e bloqueiam a publicação.

Uso: python tools/extract_prova.py [ano] [--aplicacao ppl]
"""
import json
import os
import re
import sys
import hashlib

import pymupdf
from PIL import Image

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZOOM_PAGINA = 2.5
ZOOM_COLUNA = 3.0
MID_X = 283.0
X_COL0 = (10.0, 284.0)
X_COL1 = (284.0, 557.0)

RE_QUESTAO = re.compile(r"^Quest[ãa]o\s*(\d{1,3})\b", re.I)
RE_GRUPO = re.compile(r"^Textos? para (?:as|a) quest[õo]es de (\d{1,3}) (?:a|e) (\d{1,3})", re.I)
RE_CODIGO = re.compile(r"^\*\d{6}[A-Z]{2}\d+\*$")
RE_STRIP = re.compile(r"ENEM\s*(\d{4})(?:\s*ENEM\s*\1){2,}", re.I)
RE_RODAPE = re.compile(r"(?:^|[|•–-])\s*[12][º°]\s*DIA\b", re.I)
RE_AREA = re.compile(r"Quest[õo]es de (\d{1,3}) a (\d{1,3})")
RE_IDIOMA_ING = re.compile(r"op[çc][ãa]o\s*:?\s*ingl", re.I)
RE_IDIOMA_ESP = re.compile(r"op[çc][ãa]o\s*:?\s*espanhol", re.I)
RE_FIM_SECAO = re.compile(r"Proposta de Reda[çc][ãa]o|INSTRU[ÇC][ÕO]ES PARA A REDA[ÇC][ÃA]O|FOLHA DE RASCUNHO|^RASCUNHO|^REDA[ÇC][ÃA]O", re.I)

# Faixas das áreas nos cadernos oficiais utilizados.
AREAS_PADRAO = {
    1: [(1, 45, "Linguagens"), (46, 90, "Ciências Humanas")],
    2: [(91, 135, "Ciências da Natureza"), (136, 180, "Matemática")],
}
PALAVRAS_AREA = (
    ("LINGUAGENS", "Linguagens"),
    ("CIÊNCIAS HUMANAS", "Ciências Humanas"),
    ("CIÊNCIAS DA NATUREZA", "Ciências da Natureza"),
    ("MATEMÁTICA", "Matemática"),
)


def eh_chrome(t):
    return bool(
        RE_CODIGO.match(t)
        or RE_STRIP.search(t)
        or RE_RODAPE.search(t)
        or (RE_AREA.search(t) and not (RE_IDIOMA_ING.search(t) or RE_IDIOMA_ESP.search(t)))
        or t.upper().startswith(("LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS", "CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS", "CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS", "MATEMÁTICA E SUAS TECNOLOGIAS"))
    )


def linhas_pagina(page):
    """Marcadores podem compartilhar o bloco com cabeçalhos em provas antigas."""
    for bloco in page.get_text("dict", flags=pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES)["blocks"]:
        if bloco["type"] != 0:
            continue
        for linha in bloco["lines"]:
            texto = " ".join("".join(s["text"] for s in linha["spans"]).split())
            bbox = linha["bbox"]
            if texto and bbox[1] < page.rect.height - 32 and not (texto.isdigit() and (bbox[1] > 700 or bbox[1] < 30)):
                yield (*bbox, texto)


def coletar_eventos(doc):
    """Paginas -> eventos de leitura com posicao (pagina, coluna, y).

    Uma pagina tem 2 colunas quando nenhum bloco de conteudo cruza o meio.
    Eventos especiais (marcador, grupo, idioma, fim de secao) sao detectados
    antes do filtro de chrome: o cabecalho de grupo tem a mesma cara de
    "Questoes de X a Y" dos cabecalhos de area, mas precisa virar evento.
    Retorna (eventos, paginas_com_coluna_direita).
    """
    eventos = []
    col1_paginas = set()
    for pno, page in enumerate(doc, 1):
        pares = []
        for b in linhas_pagina(page):
            t = b[4]
            if t:
                pares.append((b, t))

        if not any(RE_QUESTAO.match(t) for _, t in pares) and (
            any(RE_FIM_SECAO.search(t) for _, t in pares)
            or all(eh_chrome(t) or t.isdigit() for _, t in pares)
        ):
            eventos.append(("fimsecao", pno, 0, 0, None))
            continue

        brutos = []  # (x0, y, evento); conteudo traz (x0, y0, x1, y1, t)
        for b, t in pares:
            m = RE_QUESTAO.match(t)
            g = RE_GRUPO.match(t)
            if m:
                brutos.append((b[0], b[1], ("marcador", int(m.group(1)))))
                resto = t[m.end():].strip()
                if resto:
                    brutos.append((b[0], b[1], ("conteudo", (b[0], b[1], b[2], b[3], resto))))
            elif g:
                brutos.append((b[0], b[1], ("grupo", int(g.group(1)), int(g.group(2)))))
                resto = t[g.end():].strip()
                if resto:
                    brutos.append((b[0], b[1], ("conteudo", (b[0], b[1], b[2], b[3], resto))))
            elif RE_IDIOMA_ING.search(t) or RE_IDIOMA_ESP.search(t):
                cod = "ing" if RE_IDIOMA_ING.search(t) else "esp"
                brutos.append((b[0], b[1], ("idioma", cod)))
            elif RE_FIM_SECAO.search(t):
                brutos.append((b[0], b[1], ("fimsecao",)))
            elif not eh_chrome(t):
                brutos.append((b[0], b[1], ("conteudo", (b[0], b[1], b[2], b[3], t))))

        cruza_meio = any(
            ev[1][0] < 250 and ev[1][2] > 290 for _x, _y, ev in brutos if ev[0] == "conteudo"
        )
        duas = not cruza_meio

        def col_de(x0):
            return 1 if (duas and x0 > MID_X) else 0

        for x0, y, ev in sorted(brutos, key=lambda e: (col_de(e[0]), e[1], e[0])):
            if ev[0] == "marcador":
                eventos.append(("marcador", pno, col_de(x0), y, ev[1]))
            elif ev[0] == "grupo":
                eventos.append(("grupo", pno, col_de(x0), y, (ev[1], ev[2])))
            elif ev[0] == "idioma":
                eventos.append(("idioma", pno, col_de(x0), y, ev[1]))
            elif ev[0] == "fimsecao":
                eventos.append(("fimsecao", pno, col_de(x0), y, None))
            else:
                x0b, a, x1b, b_, _t = ev[1]
                col = col_de(x0b)
                if col == 1:
                    col1_paginas.add(pno)
                eventos.append(("conteudo", pno, col, y, (a, b_, _t)))
    return eventos, col1_paginas


def bordas_pagina(doc):
    """y do rodape (fim do conteudo) e y do fim das faixas de chrome no topo."""
    rodape_y, topo_y = {}, {}
    for pno, page in enumerate(doc, 1):
        pares = [(b, b[4]) for b in linhas_pagina(page)]
        pés = [b[1] for b, t in pares if t and b[1] > 700 and eh_chrome(t)]
        rodape_y[pno] = min(pés) if pés else page.rect.height - 36
        topos = [b[3] for b, t in pares if t and b[1] < 100 and b[3] < 100 and eh_chrome(t)]
        topo_y[pno] = max(60, max(topos) + 2) if topos else 60
    return rodape_y, topo_y


def montar_questoes(eventos, rodape_y, topo_y, ano, dia):
    """Caminha os eventos e monta os intervalos de cada questao (e dos grupos)."""
    questoes = {}  # chave -> {"num", "suf", "intervalos"}
    ordem = []
    prefixos_grupo = {}  # chave -> intervalos do texto compartilhado do grupo
    anomalias = []
    atual = None
    prefixo = None  # grupo em coleta: {"de", "ate", "intervalos"}
    idioma = None
    pular = False

    def fechar(pno_ev, col_ev, y_ev):
        alvo = atual or prefixo
        if alvo is None or not alvo["intervalos"]:
            return
        pno_u, col_u, a_u, b_u = alvo["intervalos"][-1]
        if (pno_u, col_u) == (pno_ev, col_ev):
            alvo["intervalos"][-1][3] = max(b_u, y_ev)
        else:
            alvo["intervalos"][-1][3] = max(b_u, rodape_y[pno_u])

    for tipo, pno, col, y, dado in eventos:
        if tipo == "marcador":
            num = dado
            pular = False
            fechar(pno, col, y)
            suf = idioma if (num <= 5 and idioma) else ""
            chave = f"enem{ano}-{num}" + (f"-{suf}" if suf else "")
            if prefixo is not None and prefixo["de"] <= num <= prefixo["ate"]:
                if chave in prefixos_grupo:
                    anomalias.append(f"grupo repetido para {chave}")
                prefixos_grupo[chave] = list(prefixo["intervalos"])
                if num == prefixo["ate"]:
                    prefixo = None
            elif prefixo is not None:
                anomalias.append(
                    f"grupo de {prefixo['de']} a {prefixo['ate']} interrompido pela questao {num}")
                prefixo = None
            if chave in questoes:
                anomalias.append(f"questao {chave} aparece duas vezes")
            atual = {"dia": dia, "num": num, "suf": suf, "intervalos": [[pno, col, y, y]]}
            questoes[chave] = atual
            ordem.append(chave)
        elif tipo == "idioma":
            fechar(pno, col, y)
            idioma = dado
        elif tipo == "grupo":
            fechar(pno, col, y)
            atual = None
            de, ate = dado
            prefixo = {"de": de, "ate": ate, "intervalos": []}
        elif tipo == "fimsecao":
            fechar(pno, col, y)
            atual = None
            prefixo = None
            pular = True
        elif tipo == "conteudo":
            a, b_, _t = dado
            if pular:
                continue
            alvo = atual or prefixo
            if alvo is None:
                continue  # conteudo antes da primeira questao (capa/instrucoes)
            inter = alvo["intervalos"]
            if inter and inter[-1][0] == pno and inter[-1][1] == col:
                inter[-1][3] = max(inter[-1][3], b_)
            else:
                inter.append([pno, col, topo_y[pno], b_])

    fechar(0, 0, 0)
    return questoes, ordem, prefixos_grupo, anomalias


def renderizar(doc, intervalos, col1_paginas):
    """Renderiza e costura os intervalos de uma questao; recorta margens brancas."""
    pedacos = []
    for pno, col, a, b in intervalos:
        if b - a < 2:
            continue
        page = doc[pno - 1]
        if col == 0:
            x0 = X_COL0[0]
            x1 = X_COL0[1] if pno in col1_paginas else 557.0
            zoom = ZOOM_COLUNA if pno in col1_paginas else ZOOM_PAGINA
        else:
            x0, x1 = X_COL1
            zoom = ZOOM_COLUNA
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=pymupdf.Rect(x0, a, x1, b))
        pedacos.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    if not pedacos:
        return None
    w = max(im.width for im in pedacos)
    h = sum(im.height for im in pedacos)
    final = Image.new("RGB", (w, h), "white")
    pos_y = 0
    for im in pedacos:
        final.paste(im, ((w - im.width) // 2, pos_y))
        pos_y += im.height
    cinza = final.convert("L")
    bbox = cinza.point(lambda v: 255 if v < 250 else 0).getbbox()
    if bbox:
        pad = 12
        final = final.crop((
            max(0, bbox[0] - pad), max(0, bbox[1] - pad),
            min(w, bbox[2] + pad), min(h, bbox[3] + pad),
        ))
    return final


def extrair(ano, aplicacao="regular"):
    from pathlib import Path
    from parse_gabaritos import parse_table
    modalidade = "impresso" if aplicacao == "regular" else "reaplicacao_PPL"
    pasta = Path(PROJ) / "data" / "provas_inep" / str(ano)
    saida, anuladas, erros = [], [], []
    imagens = Path(PROJ) / "data" / "images"
    imagens.mkdir(parents=True, exist_ok=True)
    for dia, cd in ((1, 1), (2, 5)):
        prova = pasta / f"{ano}_PV_{modalidade}_D{dia}_CD{cd}.pdf"
        gabarito = pasta / f"{ano}_GB_{modalidade}_D{dia}_CD{cd}.pdf"
        if not gabarito.exists() and aplicacao == "regular":
            gabarito = Path(PROJ) / "data" / "gabaritos_inep" / f"{ano}_d{dia}_cd{cd}.pdf"
        common, ingles, espanhol = parse_table(str(gabarito))
        gabdoc = pymupdf.open(gabarito)
        linhas = [x.strip() for page in gabdoc for x in page.get_text().splitlines() if x.strip()]
        anuladas_oficiais = {int(linhas[i-1]) for i,t in enumerate(linhas) if i and "ANUL" in t.upper() and linhas[i-1].isdigit()}
        anuladas_oficiais.update(int(n) for n in re.findall(r"Quest[ãa]o\s*(\d+)\s*Anulad", " ".join(linhas), re.I))
        gabdoc.close()
        doc = pymupdf.open(prova)
        eventos, colunas = coletar_eventos(doc)
        rodape, topo = bordas_pagina(doc)
        qs, ordem, grupos, anomalias = montar_questoes(eventos, rodape, topo, ano, dia)
        erros.extend(anomalias)
        esperadas = set(range(1 if dia == 1 else 91, 91 if dia == 1 else 181))
        detectadas = {q["num"] for q in qs.values()}
        if detectadas != esperadas:
            erros.append(f"Dia {dia}: faltantes={sorted(esperadas-detectadas)} extras={sorted(detectadas-esperadas)}")
        if dia == 1 and ({q["num"] for q in qs.values() if q["suf"] == "ing"} != set(range(1,6)) or {q["num"] for q in qs.values() if q["suf"] == "esp"} != set(range(1,6))):
            erros.append("Questões de idioma incompletas")
        for chave in ordem:
            q = qs[chave]
            num, idioma = q["num"], q["suf"]
            identificador = chave if aplicacao == "regular" else chave.replace(f"enem{ano}-", f"enem{ano}-{aplicacao}-", 1)
            if num in anuladas_oficiais:
                anuladas.append(identificador)
                continue
            resposta = (ingles if idioma == "ing" else espanhol if idioma == "esp" else common).get(str(num))
            if resposta not in ("A", "B", "C", "D", "E"):
                erros.append(f"{identificador}: gabarito não lido; não é anulação confirmada")
                continue
            intervalos = list(grupos.get(chave, [])) + q["intervalos"]
            if any(b <= a for _, _, a, b in intervalos):
                erros.append(f"{identificador}: intervalo de recorte inválido")
                continue
            img = renderizar(doc, intervalos, colunas)
            if img is None:
                erros.append(f"{identificador}: sem imagem")
                continue
            img.save(imagens / f"{identificador}.webp", lossless=True, method=0)
            texto = []
            for pno, col, a, b in intervalos:
                x0 = 10 if col == 0 else 284
                x1 = (284 if pno in colunas else 557) if col == 0 else 557
                texto.extend(l[4] for l in linhas_pagina(doc[pno-1]) if x0 <= l[0] < x1 and a <= l[1] < b and not eh_chrome(l[4]))
            area = next(nome for ini,fim,nome in AREAS_PADRAO[dia] if ini <= num <= fim)
            saida.append({
                "id": identificador, "exam": ano, "question": num, "image": f"images/{identificador}.webp",
                "imageSha256": hashlib.sha256((imagens / f"{identificador}.webp").read_bytes()).hexdigest(),
                "answer": resposta, "answerSource": "inep", "area": area, "materia": area,
                "aplicacao": aplicacao, "dia": dia, "caderno": cd, "idioma": idioma or None,
                "sourceUrl": f"https://download.inep.gov.br/enem/provas_e_gabaritos/{prova.name}",
                "gabaritoUrl": f"https://download.inep.gov.br/enem/provas_e_gabaritos/{ano}_GB_{modalidade}_D{dia}_CD{cd}.pdf",
                "ancora": None, "revisada": False,
                "recorte": [{"pagina": p, "coluna": c, "topo": a, "base": b} for p,c,a,b in intervalos],
                "textoExtraido": " ".join(" ".join(texto).split()),
            })
        doc.close()
    lote = {"meta": {"source": f"INEP: ENEM {ano} ({aplicacao})", "exam": ano, "aplicacao": aplicacao, "questoes": len(saida), "anuladas": anuladas, "erros": erros}, "questoes": saida}
    destino = Path(PROJ) / "data" / "lotes" / f"{ano}-{aplicacao}.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(lote, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{ano} {aplicacao}: {len(saida)} questões, {len(anuladas)} anuladas, {len(erros)} erros; lote em {destino}", flush=True)
    for erro in erros:
        print(f"  ERRO: {erro}")
    return lote


def main():
    import argparse
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Extrai para data/lotes, sem publicar nem substituir o banco.")
    parser.add_argument("ano", type=int, nargs="?", default=2025)
    parser.add_argument("--aplicacao", choices=("regular", "ppl"), default="regular")
    args = parser.parse_args()
    lote = extrair(args.ano, args.aplicacao)
    if lote["meta"]["erros"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
