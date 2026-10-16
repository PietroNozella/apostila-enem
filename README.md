# ENEM Treino

Aplicativo de estudo por questões, com apostila comentada e provas oficiais do INEP.

## Acervo

- **1.286 questões únicas**: provas regulares de 2020 a 2025 e reaplicação/PPL de 2024. Os dois idiomas estão disponíveis no banco; o aluno escolhe um no simulado. Nove questões anuladas foram excluídas.
- `data/content.json`: apostila original, com 13 matérias, 52 unidades e 156 questões comentadas. A aplicação também oferece Educação Física para as questões das provas oficiais.
- `data/banco.json`: banco acumulado com área, matéria, assunto, ano, aplicação, dia, caderno, idioma, gabarito e links dos PDFs oficiais.
- `data/lotes/`: extrações com coordenadas dos recortes; `data/revisoes/`: classificação inicial, registro da amostragem visual e assinatura do lote revisado.
- As questões da apostila e do banco são relacionadas pela identidade da prova. O catálogo preserva comentários e identificadores antigos de progresso, sem duplicar as questões no simulado.
- Questões novas podem não ter resolução comentada; a interface informa essa condição. A classificação é inicial e pode ser refinada nos arquivos de revisão.

Os enunciados continuam como imagens. Os recortes oficiais novos usam WebP sem perda, incluindo gráficos, fórmulas e alternativas. Textos compartilhados e continuações de coluna/página são incorporados à questão.

## Importar uma prova

Na raiz do projeto, com Python e `curl` disponíveis:

```bash
python -m pip install -r tools/requirements.txt
python tools/download_provas.py 2024
python tools/extract_prova.py 2024
python tools/preparar_revisao.py data/lotes/2024-regular.json
```

A preparação da revisão reinicia `recortesConferidos` como `false`. Confira as imagens em `data/images/`, preencha `subjectId` e `assunto` de cada questão em `data/revisoes/2024-regular.json` e registre a conferência visual. Só então marque `recortesConferidos` como `true`.

```bash
python tools/publicar_lote.py data/lotes/2024-regular.json data/revisoes/2024-regular.json
python tools/validar_banco.py
```

Para reaplicação/PPL, use `--aplicacao ppl` no download e na extração; os arquivos do lote e da revisão terão o sufixo `-ppl.json`.

A extração não altera o banco publicado. A publicação bloqueia lotes incompletos, erros de extração, classificação ausente, gabarito divergente e imagens alteradas após a extração. A revisão deve corresponder à assinatura atual do lote. A importação acumula anos, preserva comentários existentes e atualiza as cópias em `web/lib/` e `web/public/images/`.

A ausência de letra no parser não confirma uma anulação: somente a marca explícita no gabarito oficial permite excluir a questão como anulada.

## Apostila e aplicação

O pipeline original da apostila permanece disponível:

```bash
python tools/build_content.py "caminho/Apostila de estudo ENEM.pdf"
python tools/parse_gabaritos.py
python tools/apply_gabaritos.py
python tools/validate_content.py
```

Ao regenerar a apostila, atualize também a cópia `web/lib/content.json` e suas imagens. Os detalhes para rodar o aplicativo e testar os fluxos estão em [web/README.md](web/README.md).

```bash
python -m unittest discover -s tools -p "test_*.py"
python tools/validar_banco.py
```

## Fontes

Os PDFs são baixados de `https://download.inep.gov.br/enem/provas_e_gabaritos/`. As URLs de prova e gabarito ficam em cada questão; os downloads novos também registram `fontes-regular.json` ou `fontes-ppl.json` junto aos PDFs. O relatório atual fica em `data/prova_check.txt`.

A convenção adotada é caderno **1 (azul)** no primeiro dia e **5 (amarelo)** no segundo dia. Os identificadores distinguem aplicação regular, PPL e idioma; não se importam outras cores como questões novas.

- Enunciados das questões são do INEP sob licença **CC BY-ND 3.0** (atribuição, sem derivações). Verificar implicações antes de monetizar.
