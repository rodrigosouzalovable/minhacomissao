# Etiquetar a conversa já no envio (antes do cliente responder)

## Causa confirmada (verificada no banco e no código)

Caso do print (RAQUELL DA SILVA DE OLIVEIRA, 61 98358-1324):

- A mensagem de saída existe com o texto `*Atendente Yasmim:* ...`, enviada às 09:28, e o contato está na caixa **Padrão** (`folder_id` nulo).
- A conversa está com **zero etiquetas**.
- A etiqueta `Atendente: Yasmim Batista Sousa Silva` existe e está ativa.
- O envio foi registrado com o `user_id` de RODRIGO RIBEIRO DE SOUZA (login usado no disparo), e esse usuário **não** está na lista de responsáveis da caixa Padrão (`meta_inbox_default_members` sem registro para ele).

A função de envio só aplica a etiqueta se **quem disparou** for responsável pela caixa do contato. Como o remetente técnico não é responsável pela Padrão, a etiqueta é descartada — mesmo o nome do atendente estando explícito na mensagem. Além disso, envios em massa (Envio Meta / Modo Rajada) não enviam o nome do atendente e envios de texto livre nunca etiquetam.

## O que será feito

### 1. A etiqueta passa a seguir o atendente informado, não o remetente técnico

No envio de template do Inbox (Nova conversa e Reabrir com template):

- A validação deixa de exigir que o remetente seja responsável pela caixa. Passa a validar o **atendente nomeado** na mensagem: ele precisa ter a permissão "Atende no Inbox Meta Oficial" e ser responsável pela caixa da conversa (caixa Padrão usa os responsáveis padrão).
- Se o atendente nomeado for elegível, a etiqueta `Atendente: <Nome>` é aplicada imediatamente ao contato, com `origem = auto_atendente` — sem esperar resposta do cliente.
- Se o nome não casar com nenhuma etiqueta existente ou o atendente não for elegível, nada é etiquetado (comportamento atual, nada é atribuído "no chute"). O sistema continua não criando etiquetas sozinho.
- A regra de exclusividade continua valendo: no máximo uma etiqueta de atendente por conversa.

### 2. Mesma marcação no texto livre

Quando um atendente envia texto livre dentro da janela de 24h e a conversa ainda não tem etiqueta de atendente, a conversa é etiquetada com a etiqueta dele (mesma validação de permissão e caixa). Mensagens da IA não etiquetam.

### 3. Correção do histórico recente

Nas conversas dos últimos 30 dias sem etiqueta de atendente, mas cuja última mensagem enviada traz o prefixo `*Atendente <Nome>:*`, aplicar a etiqueta correspondente — resolvendo o caso do print e outros iguais.

## Fora do escopo

Disparos em massa (Envio Meta / Modo Rajada) continuam sem etiqueta de atendente, pois não têm um atendente responsável definido. Se quiser, depois podemos incluir a escolha do atendente na campanha.

## Detalhes técnicos

- `supabase/functions/send-whatsapp-meta/index.ts` (bloco "Aplicar etiqueta Atendente"): resolver primeiro a etiqueta por `Atendente: <primeiro nome>%`; mapear a etiqueta → `profiles.nome` → `user_id`; validar esse `user_id` em `user_permissions.atende_inbox_meta` e em `meta_inbox_folder_members` (ou `meta_inbox_default_members` quando `folder_id` nulo); remover a checagem baseada no remetente.
- `supabase/functions/send-whatsapp-meta-text/index.ts`: após inserir a mensagem de saída de um atendente humano, aplicar a mesma rotina (extraída para `supabase/functions/_shared/`), somente se o contato não tiver etiqueta com `origem = 'auto_atendente'`.
- Correção do histórico por instruções de dados (sem mudança de schema), com `origem = 'auto_atendente'`.
- Sem novo cron, polling ou canal Realtime — nenhum impacto de custo.
