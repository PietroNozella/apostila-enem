# -*- coding: utf-8 -*-
"""Extrai as questoes das provas oficiais do ENEM (PDFs do INEP) para o banco do simulado.

Entrada: data/provas_inep/<ano>/<ano>_PV_impresso_D1_CD1.pdf e _D2_CD5.pdf (prova)
         data/gabaritos_inep/<ano>_d1_cd1.pdf e _d2_cd5.pdf (gabarito)
Saida:   data/images/enem<ano>-*.png + data/banco.json + data/prova_check.txt

Como funciona: caminha cada prova em ordem de leitura (coluna esquerda antes da
direita, topo para baixo), detecta os marcadores "Questao NN" e recorta cada
questao como imagem; questoes que atravessam pagina/coluna sao costuradas
verticalmente. Textos compartilhados ("Texto para as questoes de X a Y") sao
prefixados a todas as questoes do grupo. O 1o dia imprime as DUAS versoes das
questoes 1-5 (opcao ingles / espanhol); cada versao vira uma questao do banco
com sufixo -ing/-esp. Questoes anuladas (sem letra no gabarito) ficam de fora.

Uso: python tools/extract_prova.py [ano]
"""
import json
import os
import re
import sys

import pymupdf
from PIL import Image

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZOOM_PAGINA = 2.5
ZOOM_COLUNA = 3.0
MID_X = 283.0
X_COL0 = (10.0, 284.0)
X_COL1 = (284.0, 557.0)

RE_QUESTAO = re.compile(r"^Quest[ãa]o\s*(\d{1,3})\b")
RE_GRUPO = re.compile(r"^Textos? para (?:as|a) quest[õo]es de (\d{1,3}) (?:a|e) (\d{1,3})", re.I)
RE_CODIGO = re.compile(r"^\*\d{6}[A-Z]{2}\d+\*$")
RE_STRIP = re.compile(r"^ENEM(\d{4})(?:ENEM\1){2,}")
RE_RODAPE = re.compile(r"\| \d+º DIA \|")
RE_AREA = re.compile(r"Quest[õo]es de (\d{1,3}) a (\d{1,3})")
RE_IDIOMA_ING = re.compile(r"op[çc][ãa]o ingl", re.I)
RE_IDIOMA_ESP = re.compile(r"op[çc][ãa]o espanhol", re.I)
RE_FIM_SECAO = re.compile(r"Proposta de Reda[çc][ãa]o|FOLHA DE RASCUNHO", re.I)

# Estrutura padrao do ENEM (ajustada pelos cabecalhos de area, quando lidos)
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
        or RE_STRIP.match(t)
        or RE_RODAPE.search(t)
        or (RE_AREA.search(t) and not (RE_IDIOMA_ING.search(t) or RE_IDIOMA_ESP.search(t)))
    )


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
        for b in page.get_text("blocks"):
            if b[6] != 0:
                continue
            t = " ".join(b[4].split())
            if t:
                pares.append((b, t))

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
        pares = [(b, " ".join(b[4].split())) for b in page.get_text("blocks") if b[6] == 0]
        pés = [b[1] for b, t in pares if t and b[1] > 700 and eh_chrome(t)]
        rodape_y[pno] = min(pés) if pés else page.rect.height - 20
        topos = [b[3] for b, t in pares if t and b[1] < 100 and eh_chrome(t)]
        topo_y[pno] = max(topos) + 2 if topos else 60
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
                if num == prefixo["de"]:
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


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    ano = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from parse_gabaritos import parse_table

    gab = {}
    for dia, cd in ((1, 1), (2, 5)):
        common, ingles, espanhol = parse_table(
            os.path.join(PROJ, "data", "gabaritos_inep", f"{ano}_d{dia}_cd{cd}.pdf"))
        gab[dia] = {"common": common, "ingles": ingles, "espanhol": espanhol}

    areas = {dia: [list(r) for r in AREAS_PADRAO[dia]] for dia in (1, 2)}
    anomalias = []
    docs = {}
    col1_por_dia = {}
    questoes = {}
    ordem = []
    prefixos_grupo = {}

    for dia in (1, 2):
        caminho = os.path.join(PROJ, "data", "provas_inep", str(ano),
                               f"{ano}_PV_impresso_D{dia}_CD{1 if dia == 1 else 5}.pdf")
        doc = pymupdf.open(caminho)
        docs[dia] = doc
        eventos, col1_paginas = coletar_eventos(doc)
        col1_por_dia[dia] = col1_paginas
        rodape_y, topo_y = bordas_pagina(doc)
        qs, oq, pg, an = montar_questoes(eventos, rodape_y, topo_y, ano, dia)
        questoes.update(qs)
        ordem.extend(oq)
        prefixos_grupo.update(pg)
        anomalias += an

    # faixas de area lidas dos cabecalhos (ajustam o padrao; divergencia e reportada)
    for dia in (1, 2):
        for page in docs[dia]:
            for b in page.get_text("blocks"):
                if b[6] != 0:
                    continue
                t = " ".join(b[4].split())
                m = RE_AREA.search(t)
                if not m or RE_IDIOMA_ING.search(t) or RE_IDIOMA_ESP.search(t):
                    continue
                for palavra, nome in PALAVRAS_AREA:
                    if palavra in t.upper():
                        ini, fim = int(m.group(1)), int(m.group(2))
                        for faixa in areas[dia]:
                            if faixa[0] <= ini <= faixa[1] and faixa[2] != nome:
                                anomalias.append(
                                    f"cabecalho troca {faixa[2]} por {nome} na faixa {ini}-{fim}")
                        for i, faixa in enumerate(areas[dia]):
                            if faixa[0] <= ini <= faixa[1]:
                                areas[dia][i] = [ini, fim, nome]

    # sequencia esperada de questoes
    esperados = []
    for dia in (1, 2):
        ini = 1 if dia == 1 else 91
        fim = 90 if dia == 1 else 180
        for num in range(ini, fim + 1):
            if num <= 5:
                esperados += [f"enem{ano}-{num}-ing", f"enem{ano}-{num}-esp"]
            else:
                esperados.append(f"enem{ano}-{num}")
    faltando = [k for k in esperados if k not in questoes]
    extras = [k for k in questoes if k not in esperados]
    if faltando:
        anomalias.append(f"questoes nao detectadas na prova: {faltando}")
    if extras:
        anomalias.append(f"questoes fora do esperado: {extras}")

    def materia_de(dia, num, suf):
        if suf:
            return "Inglês" if suf == "ing" else "Espanhol"
        for ini, fim, nome in areas[dia]:
            if ini <= num <= fim:
                return nome
        return "Linguagens"

    def resposta(dia, num, suf):
        g = gab[dia]
        if num <= 5 and suf:
            return g["ingles" if suf == "ing" else "espanhol"].get(str(num))
        return g["common"].get(str(num))

    saida = []
    anuladas = []
    sem_conteudo = []
    contagem = {}
    for chave in ordem:
        q = questoes[chave]
        resp = resposta(q["dia"], q["num"], q["suf"])
        if resp is None:
            anuladas.append(chave)
            continue  # anulada: nao entra no banco nem gera imagem
        intervalos = list(prefixos_grupo.get(chave, [])) + q["intervalos"]
        img = renderizar(docs[q["dia"]], intervalos, col1_por_dia[q["dia"]])
        if img is None:
            sem_conteudo.append(chave)
            continue
        img.save(os.path.join(PROJ, "data", "images", chave + ".png"))
        materia = materia_de(q["dia"], q["num"], q["suf"])
        contagem[materia] = contagem.get(materia, 0) + 1
        saida.append({
            "id": chave,
            "exam": ano,
            "question": q["num"],
            "image": f"images/{chave}.png",
            "answer": resp,
            "answerSource": "inep",
            "materia": materia,
            "ancora": None,
        })

    relatorio = [f"prova ENEM {ano}: {len(saida)} questoes no banco"]
    for materia, n in sorted(contagem.items()):
        relatorio.append(f"  {materia}: {n}")
    relatorio.append(f"anuladas (sem letra no gabarito): {', '.join(anuladas) or 'nenhuma'}")
    if sem_conteudo:
        relatorio.append(f"sem conteudo: {', '.join(sem_conteudo)}")
    relatorio += [f"anomalia: {a}" for a in anomalias]

    with open(os.path.join(PROJ, "data", "banco.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {
                "source": f"Provas oficiais do ENEM {ano} (INEP), impresso D1 CD1 e D2 CD5",
                "exam": ano,
                "questoes": len(saida),
                "anuladas": anuladas,
            },
            "questoes": saida,
        }, f, ensure_ascii=False, indent=1)

    texto = "\n".join(relatorio)
    with open(os.path.join(PROJ, "data", "prova_check.txt"), "w", encoding="utf-8") as f:
        f.write(texto)
    print(texto)


if __name__ == "__main__":
    main()
