"""Publica um lote revisado por merge, preservando os demais anos e comentários."""
import argparse
import json
from pathlib import Path
import shutil
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def carregar(path):
    return json.loads(path.read_text(encoding="utf-8"))


def mesclar_banco(banco, lote, classificacao):
    if lote["meta"].get("erros"):
        raise ValueError("Lote contém erros de extração; publicação bloqueada")
    existentes = {q["id"]: q for q in banco["questoes"]}
    ids = [q["id"] for q in lote["questoes"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Identidade repetida no lote")
    for q in lote["questoes"]:
        tag = classificacao.get(q["id"])
        if not tag or not tag.get("subjectId") or not tag.get("assunto"):
            raise ValueError(f"Classificação pendente: {q['id']}")
        antigo = existentes.get(q["id"], {})
        if antigo.get("answer") and antigo["answer"] != q["answer"]:
            raise ValueError(f"Gabarito divergente: {q['id']}")
        item = {k: v for k, v in q.items() if k not in ("textoExtraido", "recorte")}
        existentes[q["id"]] = {**antigo, **item, **tag, "revisada": True}
        if antigo.get("commentary"):
            existentes[q["id"]]["commentary"] = antigo["commentary"]
    for id_anulado in lote["meta"]["anuladas"]:
        existentes.pop(id_anulado, None)
    questoes = sorted(existentes.values(), key=lambda q: (q["exam"], q.get("aplicacao", "regular"), q["question"], q.get("idioma") or ""))
    anuladas = sorted(set(banco["meta"].get("anuladas", [])) | set(lote["meta"]["anuladas"]))
    return {"meta": {"source": "Provas oficiais do ENEM (INEP)", "exams": sorted({q["exam"] for q in questoes}), "questoes": len(questoes), "anuladas": anuladas}, "questoes": questoes}


def publicar(lote_path, revisao_path, root=ROOT):
    lote = carregar(lote_path)
    if len(lote["questoes"]) + len(lote["meta"]["anuladas"]) != 185:
        raise ValueError("Lote incompleto: esperadas 185 questões incluindo os dois idiomas e as anuladas")
    revisao = carregar(revisao_path)
    if revisao.get("recortesConferidos") is not True:
        raise ValueError("Conferência visual do lote não registrada")
    if revisao.get("loteSha256") != hashlib.sha256(lote_path.read_bytes()).hexdigest():
        raise ValueError("A revisão não corresponde à versão atual do lote")
    materias = {s["id"]: s for s in carregar(root / "data/content.json")["subjects"]}
    materias["educacao-fisica"] = {"name": "Educação Física", "area": "Linguagens"}
    tags = revisao["classificacao"]
    for q in lote["questoes"]:
        tag = tags.get(q["id"], {})
        subject = materias.get(tag.get("subjectId"))
        if not subject or subject["area"] != q["area"]:
            raise ValueError(f"Matéria/área inconsistente: {q['id']}")
        if q.get("imageSha256") != hashlib.sha256((root / "data" / q["image"]).read_bytes()).hexdigest():
            raise ValueError(f"Imagem alterada após a extração: {q['id']}")
        tag["materia"] = subject["name"]
        with Image.open(root / "data" / q["image"]) as imagem:
            imagem.verify()
    banco_path = root / "data/banco.json"
    banco = carregar(banco_path) if banco_path.exists() else {"meta": {}, "questoes": []}
    resultado = mesclar_banco(banco, lote, tags)
    # Todas as validações ocorrem antes de publicar dados e assets.
    for q in lote["questoes"]:
        destino = root / "web/public" / q["image"]
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / "data" / q["image"], destino)
    texto = json.dumps(resultado, ensure_ascii=False, indent=1) + "\n"
    for destino in (banco_path, root / "web/lib/banco.json"):
        temporario = destino.with_suffix(".tmp")
        temporario.write_text(texto, encoding="utf-8")
        temporario.replace(destino)
    print(f"Publicado: {len(lote['questoes'])} questões; banco acumulado: {len(resultado['questoes'])}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lote", type=Path)
    parser.add_argument("revisao", type=Path)
    args = parser.parse_args()
    publicar(args.lote, args.revisao)
