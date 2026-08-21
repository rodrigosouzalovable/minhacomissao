# Bloquear Blacklist no Envio Meta

## Objetivo
Quando um cliente clicar no botão "Bloquear contato" de um template (a resposta chega no Inbox Meta Oficial como a mensagem "Bloquear contato"), o número entra automaticamente na blacklist e nunca mais recebe disparos.

## Como vai funcionar na tela

1. Na aba **Envio Meta**, novo bloco **"Bloquear Blacklist"** com chave liga/desliga — **ativado por padrão**.
   - Ligado: antes de disparar, o sistema remove da base todos os números da blacklist e mostra no resumo "X contatos ignorados (blacklist)".
   - Desligado: os números da blacklist voltam a ser considerados no disparo (fica registrado o aviso de risco no card).
2. O estado da chave é global (vale para mim e para os Parceiros Meta), guardado na configuração de envio.
3. A confirmação de disparo passa a informar quantos números foram removidos por blacklist, junto dos já removidos por supressão.

## Como o contato entra na blacklist

- No Inbox Meta Oficial, quando chega uma resposta de botão (ou texto) cujo conteúdo é "Bloquear contato" (tolerante a maiúsculas/acentos/variações como "bloquear contato", "bloquear o contato"), o sistema:
  - grava o número na blacklist com motivo `blacklist_botao`;
  - encerra o atendimento automático: o IAGO não responde mais nem faz follow-up nessa conversa;
  - a mensagem continua aparecendo normalmente na conversa (nada é apagado).
- Números já na lista de supressão por falha de entrega continuam funcionando como hoje, sem mistura de motivos.

## Detalhes técnicos

Banco (migração):
- `meta_envio_pool_config`: nova coluna `blacklist_ativa boolean not null default true`.
- Reaproveita a tabela existente `meta_destinatario_supressao` (chave `telefone_sufixo`), com `motivo = 'blacklist_botao'`. Sem nova tabela, sem mudança de RLS/grants.

Backend:
- `supabase/functions/meta-whatsapp-webhook/index.ts`: no ponto onde a mensagem recebida é normalizada (`m.button?.text` / `m.interactive?.button_reply?.title`), detectar o pedido de bloqueio via helper novo `ehPedidoBloqueioContato(texto)` em `_shared/`; ao detectar, faz `upsert` em `meta_destinatario_supressao` (motivo `blacklist_botao`) e marca o estado da conversa para não acionar IAGO/follow-up (mesmo caminho já usado no encerramento definitivo por "pessoa errada").
- `_shared/iago.ts`: guarda extra — não responder quando o telefone estiver na blacklist.
- `envio-meta-massa-iniciar`: separar as duas higienes — a filtragem por `motivo = 'blacklist_botao'` passa a depender de `blacklist_ativa` (independente de `supressao_ativa`), e a resposta devolve `bloqueadosBlacklist` para exibição na UI.
- `meta-campanha-tick` (campanhas agendadas) e `lembrete-meta-*` reaproveitam a mesma filtragem quando a chave está ligada.

Frontend:
- `src/pages/EnvioMeta.tsx`: novo card/bloco com `Switch` "Bloquear Blacklist" lendo e gravando `meta_envio_pool_config.blacklist_ativa`; contagem de ignorados no resumo/confirmação de disparo.

Sem novo cron, polling ou realtime — nenhum impacto de custo no Cloud.
