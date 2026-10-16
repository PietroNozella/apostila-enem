# ENEM Treino — aplicação

Next.js 16 e Tailwind 4, consumindo as cópias de `data/content.json` e `data/banco.json`. Site: https://enem-treino.vercel.app.

## Rodar e verificar

```bash
npm install
npm run dev
npm run check
npm run test:e2e
```

`check` executa lint sem avisos, testes de lógica/API e build de produção. `test:e2e` inicia um servidor de produção temporário em `localhost:3100` e executa Playwright; exige um build atual e Chromium instalado (`npx playwright install chromium`). Para usar um servidor existente, defina `QA_BASE`.

Os testes E2E verificam filtros, revisão de erros, imagens ampliadas, sincronização com falha/recuperação, idioma, retomada, expiração e layout móvel. O Supabase é simulado nos testes, sem gravações remotas. As capturas ficam em `qa/` e são ignoradas pelo Git. O comando anterior `node qa/simulado.mjs` executa a mesma suíte.

`node qa/fotos.mjs` continua disponível para capturas gerais com um servidor em `localhost:3000`.

## Estudo por matéria

- Banco completo integrado às páginas `/materia/[slug]`, com filtros de assunto, ano e situação: não respondidas, erradas e corretas.
- Revisão por “Refazer erradas”; o resultado anterior permanece salvo até uma nova resposta. A tentativa anterior também é guardada após a correção.
- Ampliação de imagens com diálogo nativo, navegação por teclado e fechamento com Escape.
- A apostila e suas resoluções permanecem em `/unidade/[id]`. Questões sem comentário exibem “Sem resolução comentada”.

O catálogo relaciona os registros da apostila às provas oficiais, preservando os identificadores legados. Educação Física aparece como matéria própria, mesmo sem unidades na apostila.

## Progresso e sincronização

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são necessárias apenas para sincronizar. Configure-as em `.env.local` e no ambiente de publicação; a chave fica exclusivamente na rota do servidor.

- Sem login: respostas em `enem-treino:progresso`, no `localStorage`. Os contadores atualizam imediatamente após respostas e conexão de código.
- O código de estudo (`XXXX-XXXX`) identifica a cópia remota. Quem possui esse código pode acessar e atualizar esse progresso.
- A fila envia também respostas feitas durante um envio anterior. Falhas HTTP/rede mantêm a pendência persistida (`enem-treino:pendente`). Há nova tentativa ao reconectar, focar/retomar a página ou após 30 segundos, além do botão manual.
- O status de salvamento aparece em todas as páginas. Se o armazenamento estiver bloqueado, o app mantém o progresso em memória e informa a limitação.
- O servidor confere identidades e alternativas pelo catálogo e recalcula os acertos. Faz merge por data da resposta e escrita condicional por `atualizado_em`, repetindo o merge quando outro dispositivo vence a gravação.

A implementação reutiliza a tabela `progressos` existente (`codigo`, `dados`, `atualizado_em`), sem migração. Mantém o acesso via `service_role` no servidor e a configuração de RLS descrita anteriormente: sem políticas públicas para a tabela. Os testes não atestam a configuração do banco remoto.

## Simulado reduzido

`/simulado`: 45 questões únicas, distribuídas entre as quatro áreas, com escolha de inglês ou espanhol e prazo de 150 minutos. É um formato reduzido de treino.

O andamento e o resultado permanecem em `enem-treino:simulado`, apenas no navegador. Ao finalizar, as respostas marcadas passam ao progresso de estudo e podem ser sincronizadas. Reabrir retoma a prova; se o prazo terminou, fecha com as respostas salvas. O resultado mostra acertos totais e por matéria, gabarito, imagens e links para os comentários existentes na apostila.
