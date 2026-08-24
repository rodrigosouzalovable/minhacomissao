# Credor na campanha e no cabeçalho do Inbox

## O que muda

### 1. Envio Meta — seletor de credor

Na parte de baixo da aba "Envio Meta", ao lado dos campos de caixa de mensagens/delay (antes do botão "Disparar"/"Agendar"), um novo seletor **Credor** com três opções:

- **Novo Mundo** (com a logo Novo Mundo ao lado do nome)
- **UME** (com a logo UME ao lado do nome)
- **Não informar** (padrão)

O que for selecionado vale para todos os contatos da campanha — exceto quando a planilha traz a informação por linha (item 2).

### 2. Coluna "Credor" na planilha

No diálogo de mapeamento de colunas da importação passa a existir o papel **Credor**. Detecção automática quando o cabeçalho contiver "credor"/"cliente credor"/"carteira".

Reconhecimento de valores por linha (sem diferenciar maiúsculas/acentos):

- "novo mundo", "nm", "novomundo" → Novo Mundo
- "ume", "umme", "ume novo mundo" → UME
- vazio ou desconhecido → cai no credor escolhido no seletor (ou "não informar")

Assim é possível importar uma lista mista com os dois credores.

### 3. Inbox Meta Oficial — credor no cabeçalho

No cabeçalho de cada conversa, ao lado do nome do contato, aparece um selo com a **logo do credor + nome** (Novo Mundo ou UME). Quando o contato não tem credor definido, nenhum selo é exibido.

O credor fica gravado no contato no momento do envio, então toda campanha disparada de agora em diante já marca as conversas automaticamente. Campanhas rodando neste momento marcam os contatos conforme as mensagens vão saindo.

### 4. Ajuste manual

Clicando no selo do credor no cabeçalho, o atendente pode trocar o credor da conversa (Novo Mundo / UME / não informar) — útil para conversas antigas ou contatos importados sem credor.

## Detalhes técnicos

**Banco (migração)**
- `meta_whatsapp_contatos`: nova coluna `credor text` (nulo = não informado).
- `envio_meta_job`: nova coluna `credor text` (credor padrão da campanha).
- `envio_meta_job_item`: nova coluna `credor text` (credor por linha da planilha).
- Índice leve em `meta_whatsapp_contatos (credor)` apenas se necessário para filtros futuros — não será criado agora para não aumentar custo.

**Frontend**
- `src/lib/credorMarcas.ts` (novo): mapa `{ slug, nome, logo }` para `novo_mundo` e `ume`, mais `normalizarCredor(texto)` usado pela importação, e componente/`helper` de exibição do selo.
- Logo UME: criada como asset CDN a partir do arquivo enviado (`lovable-assets`); Novo Mundo reutiliza `src/assets/logo-novo-mundo.png`.
- `src/pages/EnvioMeta.tsx`: estado `credor`, seletor com logos, envio do campo em `iniciar({ ... credor })`; credor por linha vindo da planilha entra em cada cliente.
- `src/components/meta/MapearColunasImportDialog.tsx`: papel `credor` + detecção por cabeçalho, retornando o valor normalizado por telefone junto com `varsByTel`.
- `src/contexts/EnvioMetaSendingContext.tsx`: `IniciarParams.credor` e `ClienteRow.credor`.
- `src/pages/InboxMeta.tsx`: selo com logo no cabeçalho + popover simples para alterar o credor do contato.

**Edge functions**
- `envio-meta-massa-iniciar`: aceita `credor` no body, grava em `envio_meta_job.credor` e `envio_meta_job_item.credor` (linha ou fallback do job).
- `envio-meta-massa-tick` e `envio-meta-massa-burst`: repassam `credor` do item para o `send-whatsapp-meta`.
- `send-whatsapp-meta`: ao criar/atualizar o contato, grava `credor` quando informado (nunca sobrescreve com vazio).

Sem novos crons, polling, realtime ou consultas extras — custo de backend inalterado.

## Passos

1. Migração das três colunas.
2. Asset da logo UME + `src/lib/credorMarcas.ts`.
3. Seletor de credor no Envio Meta e propagação pelo contexto.
4. Papel "Credor" no diálogo de mapeamento da planilha.
5. Edge functions: persistir e repassar o credor até o contato.
6. Selo com logo no cabeçalho do Inbox + troca manual.
7. Build/typecheck.
