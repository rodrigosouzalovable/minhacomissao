# Blacklist: botão "Reativar" e caixa de origem do bloqueio

## Situação atual (verificada)
- A lista de bloqueios guarda telefone, nome, instância de origem, credor, motivo e data — não guarda em qual caixa de mensagens o contato estava.
- A conversa no Inbox já tem a caixa gravada, então é possível registrar essa informação no momento do bloqueio.
- Hoje só existe um ícone de lixeira (para administradores), sem rótulo, e ele apenas apaga a linha.

## O que vai ser feito

### 1. Botão "Reativar" em cada número
- Cada linha ganha um botão claro **"Reativar"** (com confirmação).
- Ao confirmar: o número sai da blacklist e volta a receber campanhas e lembretes imediatamente.
- Também é retirada a etiqueta "Aguardando Humano" criada pelo pedido de bloqueio, quando ainda estiver lá.
- Fica um aviso de sucesso ("Número reativado — já pode receber mensagens") e a lista se atualiza.
- Disponível para administradores e, no caso dos Parceiros Meta, apenas para os números originados nas instâncias deles.

### 2. Ver em qual caixa o cliente pediu o bloqueio
- No momento do bloqueio passa a ser gravada a caixa de mensagens da conversa (ex.: IA, CERTIFICADO, AQUECIMENTO) e também qual botão/frase originou o pedido ("Bloquear número" ou "Bloquear contato").
- Nova coluna **Caixa** na tabela, com filtro por caixa no topo, junto dos filtros já existentes.
- A coluna Motivo passa a mostrar o texto real que o cliente enviou/clicou.
- Para os bloqueios antigos (sem essa informação), a caixa aparece como "—", e quando o contato ainda existe no Inbox a caixa atual dele é mostrada como referência.
- A exportação para Excel inclui as colunas Caixa e origem do pedido.

## Detalhes técnicos

Banco (migração):
- `meta_destinatario_supressao`: novas colunas `caixa_id uuid` (FK `meta_inbox_folders`), `caixa_nome text`, `origem_texto text`; índice em `caixa_id`.
- Sem novas policies: as regras de leitura/remoção atuais (admin total, parceiro pelas próprias instâncias) já cobrem as colunas novas.

Backend:
- `_shared/iago.ts`: `suprimirDestinatario` aceita `caixa_id`, `caixa_nome` e `origem_texto` no objeto `origem` e grava sem sobrescrever com nulo.
- `meta-whatsapp-webhook/index.ts`: no bloco de blacklist, buscar `folder_id` do contato (já consultado ali) + nome da caixa em `meta_inbox_folders`, e passar junto o texto recebido.
- Redeploy de `meta-whatsapp-webhook` (e `iago-atendimento`/`iago-followup-tick` por compartilharem o módulo).
- Sem cron, polling ou realtime novos — nenhum impacto de custo.

Frontend (`src/pages/Blacklist.tsx`):
- Consulta passa a selecionar `caixa_id, caixa_nome, origem_texto`; mapa de caixas via `meta_inbox_folders`.
- Nova coluna Caixa + `Select` de filtro por caixa; coluna Motivo exibe `origem_texto` quando houver.
- Ação "Reativar" com `AlertDialog` de confirmação, deletando a linha por `telefone_sufixo` e removendo a etiqueta "Aguardando Humano" do contato correspondente; invalida a query da lista.
- Exportação atualizada com as novas colunas.
