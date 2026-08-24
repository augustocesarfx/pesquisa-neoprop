# Deploy

Aplicação Next.js 16 **stateless**: sem banco, sem migração, sem volume
persistente. As respostas são gravadas numa planilha do Google por HTTP.

## Variáveis de ambiente

Duas são obrigatórias. Sem elas o site sobe normalmente, mas **não grava nada**.

| Variável | Obrigatória | O que faz |
| --- | --- | --- |
| `SHEETS_WEBHOOK_URL` | sim | URL do Web App do Apps Script (termina em `/exec`) |
| `SHEETS_TOKEN` | sim | Segredo compartilhado com o Apps Script |
| `APP_URL` | recomendada | URL pública, usada no card de compartilhamento |

> Os valores reais **não estão neste repositório** (que é público). Peça-os a
> quem administra a planilha, ou pegue no `.env` local de quem configurou.

`SHEETS_TOKEN` é segredo de verdade: só é lido no servidor, nunca chega ao
navegador. Não use o prefixo `NEXT_PUBLIC_` nele — esse prefixo embute o valor
no bundle do cliente.

As demais variáveis (vídeo, VTurb, botão de retorno) são opcionais e têm
padrões no código. Veja `.env.example` e `src/config/survey.ts`.

Não existem mais `DATABASE_URL` nem `EXPORT_TOKEN` — remova-as se estiverem
configuradas em algum ambiente.

## Docker (recomendado)

O `Dockerfile` na raiz já está pronto. O `next.config.ts` liga
`output: "standalone"` automaticamente fora da Vercel, então o build gera
`.next/standalone/server.js`.

```bash
docker build -t pesquisa-neoprop .

docker run -p 3000:3000 \
  -e SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec" \
  -e SHEETS_TOKEN="..." \
  -e APP_URL="https://pesquisa.neoprop.com.br" \
  pesquisa-neoprop
```

Node 22, porta 3000, roda como usuário não-root (`nextjs`).

## Sem Docker

```bash
npm ci
npm run build
npm start
```

Mesmas variáveis no ambiente do processo.

## Requisitos de rede

**O servidor precisa alcançar `script.google.com` na saída.** É para lá que as
respostas são enviadas. Com egress bloqueado ou firewall de saída restritivo:

- salvamentos parciais falham em silêncio (por design — são só progresso);
- o envio final devolve erro 500 e o respondente vê a mensagem de falha.

Nenhum tráfego de entrada além do HTTP normal da aplicação.

## Atrás de proxy / load balancer

O rate limit por IP (`src/app/api/survey/route.ts`, 120 req/h) usa o header
`X-Forwarded-For`. Duas consequências:

- **o proxy precisa repassar esse header** — sem ele todos os respondentes são
  contados como um único IP, e um disparo grande de e-mail pode bater no teto;
- a contagem é **em memória, por processo**. Com várias réplicas cada uma tem
  sua própria contagem, o que afrouxa o limite (não bloqueia indevidamente).

## Health check

`GET /` responde 200 e é estático. Serve como liveness/readiness.

Vale notar que ele **não** testa a conexão com a planilha: o site continua
saudável mesmo se o Apps Script estiver fora. Para verificar a integração de
ponta a ponta, use o script abaixo a partir de qualquer máquina com as
variáveis configuradas:

```bash
npm run verificar-planilha
```

Ele simula o ciclo real (parcial → atualização → completo) e deixa uma linha de
teste na planilha com id começando em `TESTE-`.

## Ao mudar o Apps Script

Editar e salvar o `Codigo.gs` **não** atualiza o Web App em produção. É preciso
reimplantar: *Implantar › Gerenciar implantações › ✏️ › Versão: Nova versão ›
Implantar*. A URL é preservada nesse caminho.

É a causa mais comum de "parou de gravar do nada".
