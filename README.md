# enem-treino

Base de conteúdo para um app de treino ENEM, extraída da **Apostila ENEM 2026 – Estudo por Questões (V3)**.

## Estado atual

- `data/content.json` — 13 matérias, 52 unidades, 156 questões (1 resolvida + 2 treinos por unidade), com explicação em texto, comentários e gabaritos
- `data/images/` — 156 imagens (enunciado + alternativas de cada questão; questões divididas entre páginas foram costuradas)
- Todas as 156 respostas verificadas contra os gabaritos oficiais do INEP — 0 divergências (`data/gabarito_check.txt`)
- App em `web/`: catálogo navegável, treino interativo com feedback imediato, progresso local com contadores, sincronização entre dispositivos por código de estudo (Supabase) e modo simulado (45 questões cronometradas com gabarito no fim) — detalhes em `web/README.md`

## Pipeline (reproduzir)

```bash
python tools/build_content.py "caminho/Apostila de estudo ENEM.pdf"
python tools/parse_gabaritos.py
python tools/apply_gabaritos.py
python tools/validate_content.py
```

| Script | Função |
|---|---|
| `build_content.py` | Extrai unidades, textos (parágrafos) e imagens do PDF da apostila |
| `parse_gabaritos.py` | Lê os gabaritos oficiais em `data/gabaritos_inep/` — atenção: questões 1-5 do 1º dia têm 2 colunas (INGLÊS/ESPANHOL) |
| `apply_gabaritos.py` | Cruza respostas da apostila com o INEP; preenche letras das resolvidas; gera `data/gabarito_check.txt`. Idempotente: re-executar não altera `content.json` |
| `validate_content.py` | Relatório de qualidade (imagens, tamanhos, respostas) em `data/validation.txt` |

## Fontes oficiais (INEP)

Prefixo `https://download.inep.gov.br/enem/provas_e_gabaritos/`:

- `2023_GB_impresso_D1_CD1.pdf`, `2023_GB_impresso_D2_CD5.pdf`
- `2024_GB_impresso_D1_CD1.pdf`, `2024_GB_impresso_D2_CD5.pdf`

## Aplicação (web/)

App Next.js 16 + Tailwind 4 consumindo os dados acima.

- `web/lib/content.json` (cópia de `data/content.json`) + imagens em `web/public/images/`
- Rodar: `npm install` e `npm run dev` dentro de `web/`
- Estado: catálogo (home, `/materia/[slug]`, `/unidade/[id]`), treino interativo com feedback imediato, progresso local com contadores, sincronização por código de estudo via Supabase (rota server-side com `service_role`; ver `web/README.md`) e simulado em `/simulado` (45 questões, 2h30, gabarito no fim)

## Observações

- Convenção da apostila (e adotada no JSON): caderno **1 (azul)** no 1º dia, **5 (amarelo)** no 2º dia; questões 1-5 de Espanhol usam a coluna ESPANHOL do caderno azul.
- Enunciados das questões são do INEP sob licença **CC BY-ND 3.0** (atribuição, sem derivações). Verificar implicações antes de monetizar.
