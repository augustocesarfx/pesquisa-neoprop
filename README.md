# Pesquisa de Experiência — Neoprop

Pesquisa de NPS e experiência enviada à base de clientes e ex-clientes da
Neoprop. Sem oferta, sem venda: abertura com vídeo, 17 perguntas em quatro
blocos narrativos, ramificações por momento da jornada e respostas gravadas em
Postgres.

Projeto **standalone** — nada aqui é compartilhado com outros produtos.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict
- Tailwind CSS 4 — tokens da marca em `src/app/globals.css`
- Prisma + PostgreSQL
- Zero dependências de UI/animação: tudo é CSS e SVG próprios

```bash
npm install
cp .env.example .env     # preencha DATABASE_URL e EXPORT_TOKEN
npx prisma migrate deploy
npm run dev              # http://localhost:3000
```

## Variáveis de ambiente

| Variável | Obrigatória | O que faz |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão Postgres onde as respostas são gravadas |
| `EXPORT_TOKEN` | sim | Token que libera `/api/export`. Sem ele, o export fica fechado |
| `APP_URL` | não | URL pública, usada no card de compartilhamento |
| `NEXT_PUBLIC_SURVEY_VIDEO_PROVIDER` | não | `html5` (padrão), `youtube`, `vimeo` ou `embed` |
| `NEXT_PUBLIC_SURVEY_VIDEO_SRC` | não | URL do .mp4 (html5), ID do vídeo (youtube/vimeo) ou URL do iframe (embed). Vazio = cartão de fallback; a pesquisa segue acessível |
| `NEXT_PUBLIC_SURVEY_VIDEO_POSTER` | não | Imagem de capa do player |
| `NEXT_PUBLIC_SURVEY_BACK_URL` | não | Destino do botão "Voltar para a Neoprop" (padrão `https://neoprop.com.br`) |

Os padrões do vídeo também podem ser editados em `src/config/survey.ts`.

## Parâmetros de URL (disparo por CRM)

Todos opcionais — a pesquisa funciona sem nenhum deles:

- `?nome=`, `?email=`, `?whatsapp=` — pré-preenchem a identificação na primeira etapa;
- `?stage=<valor>` — momento da jornada já conhecido (ex.: `withdrawal_received`,
  `in_evaluation`; valores em `src/components/pesquisa/survey-data.ts`). Quando
  válido, a pergunta de jornada não é exibida e o dado fica marcado como vindo da URL;
- `?cid=<id>` — identificação do cliente no CRM, gravada em `customerRef`;
- `utm_source/medium/campaign/content/term` — preservados (localStorage + cookie)
  e gravados junto da resposta.

Exemplo: `https://pesquisa.neoprop.com.br/?nome=Ana&email=ana@x.com&whatsapp=11988887777&stage=withdrawal_received&utm_source=whatsapp`

## Estrutura da pesquisa

Primeiro a identificação (nome, e-mail e WhatsApp, obrigatórios), depois quatro
blocos que aparecem como rótulo acima de cada pergunta:

1. **Sua história** — motivação para o trade, por que uma mesa, outras mesas, como conheceu a Neoprop, momento atual
2. **Sua experiência** — expectativa versus entrega, pontos de valor, pontos de melhoria e as ramificações (suporte, reprovação/abandono, conta real, saque)
3. **Confiança e comunicação** — confiança, percepção da comunicação, conteúdos desejados
4. **Daqui para frente** — recompra e barreiras, NPS, prioridade de 30 dias, o que preservar

O NPS fica perto do fim de propósito: no início soaria como captação; no fim é a
conclusão natural da conversa. A classificação interna (detrator/neutro/promotor)
é calculada no servidor e nunca aparece para quem responde.

## Onde ver e exportar as respostas

Com o `EXPORT_TOKEN` configurado:

```bash
curl "https://pesquisa.neoprop.com.br/api/export?token=SEU_TOKEN"             # JSON com resumo de NPS
curl -o respostas.csv "https://pesquisa.neoprop.com.br/api/export?token=SEU_TOKEN&format=csv"
```

O JSON traz o NPS agregado (promotores − detratores) e as últimas 500 respostas;
o CSV traz tudo, com BOM para abrir direto no Excel. Localmente também dá para
usar `npx prisma studio`.

## Garantias da implementação

- Envio idempotente: reenviar o mesmo formulário não duplica a resposta;
- Sucesso só aparece após confirmação do servidor — nada de falso positivo;
- Rascunho em `localStorage` apenas para retomar pesquisa interrompida (a
  persistência real é sempre o banco);
- Validação e sanitização por whitelist no servidor, incluindo a coerência das
  ramificações com o momento da jornada;
- Antispam sem atrito: honeypot e tempo mínimo marcam a resposta em `flagged`,
  mas nunca a descartam; rate limit por IP;
- Acessibilidade: campos com rótulo, navegação por teclado, foco visível,
  mensagens de erro específicas e `prefers-reduced-motion` respeitado.

## Deploy

`Dockerfile` pronto (saída standalone do Next). Rode `npx prisma migrate deploy`
no bootstrap ou antes de subir o container.

## Deploy na Vercel

O build já roda `prisma generate && prisma migrate deploy` — a tabela é criada
sozinha no primeiro deploy, desde que `DATABASE_URL` esteja configurada.

1. Provisione um Postgres (Neon, Supabase ou similar) e copie a **connection
   string com pool** (serverless abre muitas conexões curtas; a URL direta
   esgota o limite do banco).
2. Em **Settings → Environment Variables** do projeto, configure no mínimo:
   `DATABASE_URL` e `EXPORT_TOKEN`.
3. Faça o redeploy.

Para rodar as migrações fora do build:

```bash
DATABASE_URL="..." npx prisma migrate deploy
```
