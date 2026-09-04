# Pesquisa de Experiência — Neoprop

Pesquisa de NPS e experiência enviada à base de clientes e ex-clientes da
Neoprop. Sem oferta, sem venda: abertura com vídeo, 17 perguntas em quatro
blocos narrativos, ramificações por momento da jornada e respostas gravadas
numa planilha do Google — inclusive as de quem não termina.

Projeto **standalone** — nada aqui é compartilhado com outros produtos.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict
- Tailwind CSS 4 — tokens da marca em `src/app/globals.css`
- Planilha do Google via Apps Script — sem banco de dados
- Zero dependências de UI/animação: tudo é CSS e SVG próprios

```bash
npm install
cp .env.example .env     # preencha SHEETS_WEBHOOK_URL e SHEETS_TOKEN
npm run dev              # http://localhost:3000
```

## Variáveis de ambiente

| Variável | Obrigatória | O que faz |
| --- | --- | --- |
| `SHEETS_WEBHOOK_URL` | sim | URL do Web App do Apps Script publicado a partir da planilha |
| `SHEETS_TOKEN` | sim | Segredo compartilhado com o Apps Script. Sem ele nada é gravado |
| `APP_URL` | não | URL pública, usada no card de compartilhamento |
| `NEXT_PUBLIC_SURVEY_VIDEO_PROVIDER` | não | `vturb` (padrão), `html5`, `youtube`, `vimeo` ou `embed` |
| `NEXT_PUBLIC_VTURB_PLAYER_ID` | não | ID do player VTurb (só no provider `vturb`) |
| `NEXT_PUBLIC_VTURB_ACCOUNT_ID` | não | ID da conta VTurb/ConverteAI (só no provider `vturb`) |
| `NEXT_PUBLIC_SURVEY_VIDEO_SRC` | não | URL do .mp4 (html5), ID do vídeo (youtube/vimeo) ou URL do iframe (embed). Vazio = cartão de fallback; a pesquisa segue acessível |
| `NEXT_PUBLIC_SURVEY_VIDEO_POSTER` | não | Imagem de capa do player |
| `NEXT_PUBLIC_SURVEY_BACK_URL` | não | Destino do botão "Voltar para a Neoprop" (padrão `https://neoprop.com.br`) |

Os padrões do vídeo também podem ser editados em `src/config/survey.ts`.

## Planilha (onde as respostas ficam)

Não há banco de dados. As respostas vão para uma planilha do Google, gravadas
por um Web App do Apps Script que roda dentro da própria planilha.

### Como ligar

1. Crie a planilha no Google Sheets;
2. **Extensões › Apps Script**, apague o conteúdo e cole
   [`scripts/apps-script/Codigo.gs`](scripts/apps-script/Codigo.gs);
3. No topo do script, troque `TOKEN` por um valor longo e aleatório;
4. **Implantar › Nova implantação › App da Web**, com *Executar como* **Eu** e
   *Quem pode acessar* **Qualquer pessoa**. Copie a URL gerada;
5. No `.env` do site: `SHEETS_WEBHOOK_URL` = a URL, `SHEETS_TOKEN` = o mesmo
   token do passo 3.

O cabeçalho é criado sozinho na primeira gravação. A aba de destino é a
constante `SHEET_NAME` no topo do script (hoje `Página 1`) — se o nome não
bater com a guia da planilha, o script grava na primeira aba em vez de
criar uma solta.

> "Qualquer pessoa" libera a URL na internet — é o `SHEETS_TOKEN` que protege a
> planilha. Trate a URL e o token como segredos, e nunca os coloque em código
> que vá para o cliente.

### Respostas incompletas

Cada respondente tem **uma linha**, identificada por um `id` gerado no
navegador. A linha é criada assim que a identificação (nome, e-mail e WhatsApp)
é preenchida e vai sendo atualizada a cada pergunta respondida — mais uma
última gravação quando a aba é fechada, via `sendBeacon`.

Ou seja: quem para na pergunta 5 e nunca volta **fica registrado**, com o
contato, as respostas até ali e onde parou. Duas colunas contam essa história:

| Coluna | O que mostra |
| --- | --- |
| `status` | `parcial` enquanto não terminou, `completo` no envio final |
| `progress` | Em que pergunta parou, ex.: `5/17` |
| `lastStep` | Id da última pergunta alcançada, ex.: `origin` |

O Apps Script nunca sobrescreve uma célula preenchida com vazio, então voltar
depois só acrescenta — o que já estava lá não se perde. Se a pessoa retomar e
concluir, é a **mesma linha** que vira `completo`.

Uma consequência a conhecer: se alguém apagar um campo de texto que já havia
preenchido, o valor antigo permanece na planilha.

### Validação

O envio final passa pela validação estrita de sempre (whitelist de todos os
campos, ramificações e detalhes obrigatórios). Os salvamentos parciais são
tolerantes por natureza — gravam o que existe, sem exigir o que ainda não foi
respondido — mas continuam filtrando por whitelist, então valor inventado não
entra na planilha.

## Delay do vídeo (VTurb)

Com o provider `vturb`, a seção final ("Agora queremos ouvir você" + botão
**Começar pesquisa**) nasce com a classe `esconder` (`display: none`) e só
aparece depois de `surveyConfig.vturb.delaySeconds` de vídeo assistido — o
próprio player revela os elementos, com `persist: true` (quem já passou do
delay não espera de novo ao recarregar).

- Tempo do delay: `delaySeconds` em `src/config/survey.ts` (hoje **135 s**);
- Para esconder mais coisa atrás do delay, basta adicionar a classe
  `esconder` ao elemento;
- `failsafeSeconds` (padrão 20 s) libera a seção se o `player.js` não carregar
  — adblock ou CDN fora não podem trancar o acesso à pesquisa. Use `0` para
  desativar essa rede de segurança.

## Quem já respondeu não responde de novo

Ao terminar a etapa de identificação, o site pergunta à planilha se aquele
**e-mail ou WhatsApp** já concluiu a pesquisa (`POST /api/survey/check` →
ação `check` no Apps Script). Se já concluiu, a pessoa vê a tela "Sua resposta
já está com a gente" em vez de refazer as 17 perguntas.

Regras que importam:

- **Só `status = completo` bloqueia.** Quem está em `parcial` parou no meio e
  precisa poder continuar — barrar essa pessoa seria perder justamente a
  resposta recuperável;
- **Na dúvida, deixa passar.** Planilha fora do ar, timeout ou limite de
  requisições devolvem "não encontrado": um duplicado é problema menor do que
  barrar quem nunca respondeu;
- **A consulta devolve só sim/não** — nunca nome, nota ou resposta de quem
  participou. Ainda assim é um endpoint público que aceita e-mail, então tem
  limite de 40 consultas por IP por hora para não virar ferramenta de varredura;
- A comparação normaliza os dois lados: e-mail em minúsculas, telefone só com
  dígitos. `(11) 91234-5678` e `11912345678` são a mesma pessoa.

## Mostrar a pesquisa do início de novo

Quem conclui passa a cair direto na tela final ao voltar ao site — inclusive
no dia seguinte. É o comportamento certo para o respondente, mas atrapalha na
hora de demonstrar a pesquisa para alguém.

Para recomeçar do vídeo no mesmo navegador:

```
https://pesquisa.neoprop.com.br/?reiniciar=1
```

O parâmetro limpa o estado local e some da barra de endereços, então um F5
depois não reinicia de novo. Não afeta a planilha: se você refizer a pesquisa
com um e-mail que já concluiu, a checagem acima mostra a tela de "já
respondeu" — para testar o fluxo inteiro, use um e-mail e um WhatsApp novos.

## Painel de análise (`/painel`)

Lê a planilha e entrega o diagnóstico pronto, sem exportar nada. Protegido por
senha: defina `PANEL_PASSWORD` (mínimo 8 caracteres). **Sem essa variável o
painel fica fechado** — a tela mostra nome, e-mail, WhatsApp e a crítica de
cada cliente, então nunca abre por esquecimento de configuração.

O que ele responde, na ordem de uma decisão:

1. **Retrato** — NPS (com a composição promotores/neutros/detratores), total de
   respostas, taxa de conclusão, confiança média, tempo mediano de preenchimento;
2. **O que os números pedem** — "Corrigir primeiro" lista os temas que os
   **detratores** apontam; "Preservar" os que os **promotores** valorizam. São as
   duas listas que viram plano de ação;
3. **Por que o índice é esse** — NPS por expectativa versus entrega e por momento
   da jornada. Segmento com NPS negativo aparece com a barra à esquerda do zero;
4. **Onde as pessoas param** — distribuição de quem abandonou, por pergunta;
5. **Respostas por pergunta** — percentual de cada alternativa, com a base sempre
   declarada (é sobre quem respondeu aquela pergunta, não sobre o total — senão as
   ramificações pareceriam irrelevantes);
6. **O que escreveram** — todas as respostas em texto livre, com busca, detratores
   primeiro.

O NPS considera **apenas quem concluiu**. Quem parou no meio pode ter dado a nota
e desistido depois; misturar os dois moveria o índice sem explicação.

### Sobre as cores

Magnitude usa uma cor só (o verde da marca) — a cor não carrega identidade, o
rótulo ao lado de cada barra carrega. A polaridade do NPS usa par divergente
**azul ↔ vermelho** com cinza no meio. Vermelho/verde seria o esperado e foi
**medido e reprovado**: os dois ficam a ΔE 4,1 em deuteranopia, ou seja, um
daltônico veria detrator e promotor da mesma cor. Azul/vermelho mede 25,7.

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

Abra a planilha. Não existe mais rota de export: a aba `Respostas` **é** o
export, já legível e filtrável, e o CSV sai por *Arquivo › Fazer download*.

Para o NPS agregado, uma fórmula na própria planilha resolve (ajuste o intervalo
da coluna `npsBand`):

```
=ROUND(100 * (COUNTIF(L:L;"promoter") - COUNTIF(L:L;"detractor"))
       / COUNTIF(L:L;"<>"); 0)
```

Filtre por `status = completo` quando quiser só quem terminou, ou por
`status = parcial` para ver quem abandonou e em que pergunta.

## Garantias da implementação

- Envio idempotente: reenviar o mesmo formulário não duplica a resposta;
- Sucesso só aparece após confirmação do servidor — nada de falso positivo;
- Rascunho em `localStorage` para retomar pesquisa interrompida; a
  persistência real é sempre a planilha;
- Quem abandona no meio fica registrado: a linha é criada na identificação e
  atualizada a cada pergunta, mais um `sendBeacon` ao fechar a aba;
- Falha ao gravar um parcial é silenciosa (é só progresso) — já o envio final
  só mostra sucesso com confirmação da planilha;
- Validação e sanitização por whitelist no servidor, incluindo a coerência das
  ramificações com o momento da jornada;
- Antispam sem atrito: honeypot e tempo mínimo marcam a resposta em `flagged`,
  mas nunca a descartam; rate limit por IP;
- Acessibilidade: campos com rótulo, navegação por teclado, foco visível,
  mensagens de erro específicas e `prefers-reduced-motion` respeitado.

## Deploy

Aplicação stateless: sem banco, sem migração, sem volume. `Dockerfile` pronto na
raiz (saída standalone do Next).

As duas variáveis obrigatórias são `SHEETS_WEBHOOK_URL` e `SHEETS_TOKEN`.
Passo a passo, requisitos de rede e configuração atrás de proxy em
**[DEPLOY.md](DEPLOY.md)**.
