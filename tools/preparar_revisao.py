"""Prepara a revisão explícita de um lote; não aprova nem publica conteúdo."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def preparar(lote_path):
    lote = json.loads(lote_path.read_text(encoding="utf-8"))
    destino = ROOT / "data/revisoes" / lote_path.name
    anterior = json.loads(destino.read_text(encoding="utf-8")) if destino.exists() else {}
    tags = anterior.get("classificacao", {})
    revisao = {
        "recortesConferidos": False,
        "loteSha256": hashlib.sha256(lote_path.read_bytes()).hexdigest(),
        "metodoRevisao": "Preencher após conferir os recortes e a classificação.",
        "classificacao": {q["id"]: tags.get(q["id"], {"subjectId": "", "assunto": ""}) for q in lote["questoes"]},
    }
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(revisao, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Revisão preparada: {destino}. Conferir e preencher antes de publicar.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lote", type=Path)
    preparar(parser.parse_args().lote)
