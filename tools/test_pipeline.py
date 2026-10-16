import unittest
from publicar_lote import mesclar_banco
from publicar_lote import publicar
from extract_prova import montar_questoes
from extract_prova import coletar_eventos, bordas_pagina, PROJ
from pathlib import Path
import pymupdf
import tempfile
import json


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.tmpbase = (Path(PROJ) / "tmp/pipeline-tests").resolve()
        self.assertTrue(self.tmpbase.is_relative_to(Path(PROJ).resolve()))
        self.tmpbase.mkdir(parents=True, exist_ok=True)

    def test_revisao_antiga_nao_publica_nem_altera_destino(self):
        lote = Path(PROJ) / "data/lotes/2025-regular.json"
        revisao = json.loads((Path(PROJ) / "data/revisoes/2025-regular.json").read_text(encoding="utf-8"))
        revisao["loteSha256"] = "0" * 64
        with tempfile.TemporaryDirectory(dir=self.tmpbase) as pasta:
            root = Path(pasta)
            path = root / "revisao.json"
            path.write_text(json.dumps(revisao), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "versão atual"):
                publicar(lote, path, root=root)
            self.assertFalse((root / "web").exists())

    def test_imagem_alterada_nao_publica(self):
        lote_path = Path(PROJ) / "data/lotes/2025-regular.json"
        lote = json.loads(lote_path.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory(dir=self.tmpbase) as pasta:
            root = Path(pasta)
            (root / "data/images").mkdir(parents=True)
            (root / "data/content.json").write_bytes((Path(PROJ) / "data/content.json").read_bytes())
            (root / "data" / lote["questoes"][0]["image"]).write_bytes(b"alterado")
            with self.assertRaisesRegex(ValueError, "Imagem alterada"):
                publicar(lote_path, Path(PROJ) / "data/revisoes/2025-regular.json", root=root)
            self.assertFalse((root / "web").exists())

    def test_importacao_acumula_anos_e_preserva_comentario(self):
        antigo = {"meta": {"anuladas": []}, "questoes": [{"id": "enem2025-6", "exam": 2025, "question": 6, "answer": "A", "commentary": "Comentário revisado"}]}
        lote = {"meta": {"anuladas": [], "erros": []}, "questoes": [{"id": "enem2024-6", "exam": 2024, "question": 6, "answer": "B"}]}
        tags = {"enem2024-6": {"subjectId": "portugues", "assunto": "Leitura"}}
        novo = mesclar_banco(antigo, lote, tags)
        self.assertEqual(len(novo["questoes"]), 2)
        self.assertEqual(novo["questoes"][1]["commentary"], "Comentário revisado")
        self.assertEqual(mesclar_banco(novo, lote, tags), novo)

    def test_lote_com_erro_ou_classificacao_pendente_nao_publica(self):
        banco = {"meta": {}, "questoes": []}
        with self.assertRaises(ValueError):
            mesclar_banco(banco, {"meta": {"erros": ["gabarito não lido"]}}, {})
        with self.assertRaises(ValueError):
            mesclar_banco(banco, {"meta": {"erros": [], "anuladas": []}, "questoes": [{"id": "q"}]}, {})

    def test_texto_compartilhado_e_anexado_a_todas_as_questoes(self):
        eventos = [("grupo", 1, 0, 60, (6, 7)), ("conteudo", 1, 0, 70, (70, 100, "Texto comum")),
                   ("marcador", 1, 0, 110, 6), ("conteudo", 1, 0, 120, (120, 150, "Questão 6")),
                   ("marcador", 1, 0, 160, 7), ("conteudo", 1, 0, 170, (170, 200, "Questão 7"))]
        _, _, grupos, anomalias = montar_questoes(eventos, {1: 740}, {1: 60}, 2025, 1)
        self.assertFalse(anomalias)
        self.assertEqual(grupos["enem2025-6"], grupos["enem2025-7"])

    def test_continuacao_de_coluna_nao_e_cortada_por_marca_dagua(self):
        with pymupdf.open(Path(PROJ) / "data/provas_inep/2022/2022_PV_impresso_D1_CD1.pdf") as doc:
            eventos, _ = coletar_eventos(doc)
            rodape, topo = bordas_pagina(doc)
            qs, _, _, _ = montar_questoes(eventos, rodape, topo, 2022, 1)
            intervalos = qs["enem2022-8"]["intervalos"]
            self.assertEqual(len(intervalos), 2)
            self.assertTrue(all(b > a for _, _, a, b in intervalos))

    def test_ultima_questao_nao_inclui_folha_de_rascunho(self):
        with pymupdf.open(Path(PROJ) / "data/provas_inep/2024/2024_PV_impresso_D1_CD1.pdf") as doc:
            eventos, _ = coletar_eventos(doc)
            rodape, topo = bordas_pagina(doc)
            qs, _, _, _ = montar_questoes(eventos, rodape, topo, 2024, 1)
            self.assertEqual({p for p, _, _, _ in qs["enem2024-90"]["intervalos"]}, {31})


if __name__ == "__main__":
    unittest.main()
