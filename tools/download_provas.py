"""Baixa um lote oficial do INEP, sem substituir PDFs já conferidos."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("anos", nargs="+", type=int)
    parser.add_argument("--aplicacao", choices=("regular", "ppl"), default="regular")
    args = parser.parse_args()
    for ano in args.anos:
        pasta = ROOT / "data" / "provas_inep" / str(ano)
        pasta.mkdir(parents=True, exist_ok=True)
        modalidade = "impresso" if args.aplicacao == "regular" else "reaplicacao_PPL"
        fontes = {}
        for dia, caderno in ((1, 1), (2, 5)):
            for tipo in ("PV", "GB"):
                nome = f"{ano}_{tipo}_{modalidade}_D{dia}_CD{caderno}.pdf"
                destino = pasta / nome
                url = f"https://download.inep.gov.br/enem/provas_e_gabaritos/{nome}"
                fontes[nome] = url
                if destino.exists() and destino.read_bytes().startswith(b"%PDF"):
                    continue
                temporario = destino.with_suffix(".part")
                subprocess.run(["curl", "--fail", "--location", "--silent", "--show-error", "--retry", "3", "--retry-all-errors", "--max-time", "90", url, "--output", str(temporario)], check=True)
                if not temporario.read_bytes().startswith(b"%PDF"):
                    raise ValueError(f"Resposta não é PDF: {url}")
                temporario.replace(destino)
                print(nome, flush=True)
        (pasta / f"fontes-{args.aplicacao}.json").write_text(json.dumps(fontes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
