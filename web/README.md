# ENEM Treino (app)

App Next.js 16 + Tailwind 4 consumindo `../data/content.json`. Em produção: https://enem-treino.vercel.app

## Rodar local

```bash
npm install
npm run dev   # http://localhost:3000
```

Build de produção local: `npm run build` e `npm run start`.

## Variáveis de ambiente

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são necessárias só para a sincronização de
progresso (em `.env.local`, fora do git; as mesmas chaves configuradas na Vercel).

## Progresso e sincronização

- Sem login: as respostas ficam em `localStorage` (`enem-treino:progresso`) e aparecem
  como contadores na home e nas páginas de matéria.
- O **código de estudo** (formato XXXX-XXXX, sem 0/O/1/I) identifica a cópia no
  Supabase: gere um na home para publicar seu progresso ou conecte um código existente.
  Conectar faz GET + merge (por questão, vence a resposta com `answeredAt` mais
  recente); cada resposta dispara um PUT silencioso.
- Segurança: a tabela `progressos` tem RLS ligada e **nenhuma política** — nem `anon`
  nem `authenticated` acessam por chave pública. Só a rota
  `app/api/progresso/[codigo]/route.ts` (server-side) lê e escreve com a chave
  `service_role`. As envs nunca chegam ao cliente; o app não usa supabase-js.

## Simulado

- `/simulado`: 45 questões sorteadas do pool da apostila (156) mais a prova oficial
  do ENEM 2025 (`../data/banco.json`, 182 questões), intercalando matérias;
  cronômetro de 2h30 com fechamento automático, navegador de questões e troca de
  alternativa até finalizar. No fim: placar total e por matéria, gabarito de cada
  questão e link para o comentário quando a questão tem unidade na apostila.
- O estado da prova fica em `localStorage` (`enem-treino:simulado`): reabrir a página
  retoma a prova em andamento; prova expirada fecha sozinha com as respostas salvas.
- Por design, o simulado não entra na sincronização por código (fica no dispositivo).

## QA visual

Com o build de produção rodando em `localhost:3000`:

```bash
node qa/fotos.mjs     # superfícies principais (desktop + mobile)
node qa/simulado.mjs  # fluxo completo do simulado
```

Os PNGs vão para `qa/` e são ignorados pelo git.
