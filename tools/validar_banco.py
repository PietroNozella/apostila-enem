"""Confere banco acumulado, gabaritos oficiais, lotes e cópias da aplicação."""
import json
import hashlib
from pathlib import Path
from PIL import Image
from parse_gabaritos import parse_table

ROOT = Path(__file__).resolve().parent.parent


def validar(root=ROOT):
    banco = json.loads((root / "data/banco.json").read_text(encoding="utf-8"))
    materias = {s["id"]: s["area"] for s in json.loads((root / "data/content.json").read_text(encoding="utf-8"))["subjects"]}
    materias["educacao-fisica"] = "Linguagens"
    ids, erros, gabaritos = set(), [], {}
    contagem = {}
    for q in banco["questoes"]:
        if q["id"] in ids:
            erros.append(f"Identidade repetida: {q['id']}")
        ids.add(q["id"])
        if materias.get(q.get("subjectId")) != q.get("area") or not q.get("assunto") or not q.get("revisada"):
            erros.append(f"Classificação incompleta: {q['id']}")
        chave = (q["exam"], q.get("aplicacao", "regular"), q["dia"], q["caderno"])
        if chave not in gabaritos:
            ano, app, dia, cd = chave
            mod = "impresso" if app == "regular" else "reaplicacao_PPL"
            gabaritos[chave] = parse_table(str(root / f"data/provas_inep/{ano}/{ano}_GB_{mod}_D{dia}_CD{cd}.pdf"))
        comum, ing, esp = gabaritos[chave]
        oficial = (ing if q.get("idioma") == "ing" else esp if q.get("idioma") == "esp" else comum).get(str(q["question"]))
        if oficial != q["answer"]:
            erros.append(f"Gabarito divergente: {q['id']}")
        for pasta in ("data", "web/public"):
            caminho = root / pasta / q["image"]
            try:
                if hashlib.sha256(caminho.read_bytes()).hexdigest() != q.get("imageSha256"):
                    erros.append(f"Assinatura de imagem divergente: {caminho}")
                with Image.open(caminho) as img:
                    if img.width < 100 or img.height < 80:
                        erros.append(f"Imagem suspeita: {q['id']}")
                    img.verify()
            except (OSError, ValueError):
                erros.append(f"Imagem ausente/inválida: {caminho}")
        grupo = f"{q['exam']}-{q.get('aplicacao', 'regular')}"
        contagem[grupo] = contagem.get(grupo, 0) + 1
    if ids & set(banco["meta"]["anuladas"]):
        erros.append("Há questões anuladas publicadas")
    if banco["meta"]["questoes"] != len(ids):
        erros.append("Total do banco inconsistente")
    for nome in ("banco.json", "content.json"):
        if (root / "data" / nome).read_bytes() != (root / "web/lib" / nome).read_bytes():
            erros.append(f"Cópia da aplicação divergente: {nome}")
    for arquivo in (root / "data/lotes").glob("*.json"):
        lote = json.loads(arquivo.read_text(encoding="utf-8"))
        for q in lote["questoes"]:
            if any(r["base"] <= r["topo"] for r in q["recorte"]):
                erros.append(f"Intervalo inválido: {q['id']}")
    linhas = [f"Banco ENEM: {len(ids)} questões únicas", *[f"  {k}: {v}" for k, v in sorted(contagem.items())], f"Anuladas excluídas: {len(banco['meta']['anuladas'])}", f"Erros: {len(erros)}", *erros]
    texto = "\n".join(linhas) + "\n"
    (root / "data/prova_check.txt").write_text(texto, encoding="utf-8")
    print(texto)
    return not erros


if __name__ == "__main__":
    raise SystemExit(0 if validar() else 1)
